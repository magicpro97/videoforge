import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('node:fs');

import { readFileSync } from 'node:fs';

import { RunwayProvider } from '../providers/runway.js';
import { FalProvider } from '../providers/fal.js';
import { ReplicateProvider } from '../providers/replicate.js';
import { VeoProvider } from '../providers/veo.js';
import { SoraProvider } from '../providers/sora.js';
import { createProvider, getAllProviderNames, createAllProviders } from '../providers/index.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.useFakeTimers();
  mockFetch.mockReset();
  vi.mocked(readFileSync).mockReturnValue(Buffer.from('fake-image-data'));
});

afterEach(() => {
  vi.useRealTimers();
});

// Suppress unhandled rejections from timer-based tests
// These are expected when testing timeout/error paths with fake timers
const originalListeners = process.listeners('unhandledRejection');
beforeEach(() => {
  process.removeAllListeners('unhandledRejection');
  process.on('unhandledRejection', () => {});
});
afterEach(() => {
  process.removeAllListeners('unhandledRejection');
  for (const listener of originalListeners) {
    process.on('unhandledRejection', listener as any);
  }
});

describe('provider registry', () => {
  it('createProvider returns known providers', () => {
    for (const name of ['runway', 'fal', 'replicate', 'veo', 'sora']) {
      const p = createProvider(name);
      expect(p.info.name).toBe(name);
    }
  });
  it('createProvider is case-insensitive', () => {
    expect(createProvider('Runway').info.name).toBe('runway');
  });
  it('createProvider throws for unknown', () => {
    expect(() => createProvider('unknown')).toThrow('Unknown provider');
  });
  it('getAllProviderNames returns 5 names', () => {
    expect(getAllProviderNames()).toEqual(['runway', 'fal', 'replicate', 'veo', 'sora']);
  });
  it('createAllProviders returns Map of 5', () => {
    const map = createAllProviders();
    expect(map.size).toBe(5);
  });
});

describe('VideoProvider base class', () => {
  it('animate throws by default', async () => {
    const p = new VeoProvider();
    await expect(p.animate({ prompt: 'test' })).rejects.toThrow('does not support image-to-video');
  });
  it('vary throws by default', async () => {
    const p = new RunwayProvider();
    await expect(p.vary({ prompt: 'test' })).rejects.toThrow('does not support video variations');
  });
});

describe('RunwayProvider', () => {
  let provider: RunwayProvider;
  beforeEach(() => { provider = new RunwayProvider(); });

  it('info returns correct data', () => {
    expect(provider.info.name).toBe('runway');
    expect(provider.info.supportedModels).toContain('gen4_turbo');
    expect(provider.info.capabilities.imageToVideo).toBe(true);
  });
  it('configure / isConfigured', () => {
    expect(provider.isConfigured()).toBe(false);
    provider.configure('key-123');
    expect(provider.isConfigured()).toBe(true);
  });
  it('validate false without key', async () => { expect(await provider.validate()).toBe(false); });
  it('validate true with key', async () => { provider.configure('k'); expect(await provider.validate()).toBe(true); });
  it('listModels', async () => { expect(await provider.listModels()).toEqual(provider.info.supportedModels); });
  it('generate throws without key', async () => {
    await expect(provider.generate({ prompt: 'test' })).rejects.toThrow('Runway API key not configured');
  });

  it('generate succeeds with polling', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'task-1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'RUNNING' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'SUCCEEDED', output: ['https://cdn/video.mp4'] }) });
    const promise = provider.generate({ prompt: 'a cat', duration: 5, aspectRatio: '9:16' });
    await vi.advanceTimersByTimeAsync(3000);
    await vi.advanceTimersByTimeAsync(3000);
    const result = await promise;
    expect(result.videos[0].url).toBe('https://cdn/video.mp4');
    expect(result.provider).toBe('runway');
  });

  it('generate uses defaults', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 't1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'SUCCEEDED', output: ['url'] }) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(3000);
    const result = await promise;
    expect(result.model).toBe('gen4_turbo');
  });

  it('generate unknown aspect ratio fallback', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 't1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'SUCCEEDED', output: ['url'] }) });
    const promise = provider.generate({ prompt: 'test', aspectRatio: '99:1' });
    await vi.advanceTimersByTimeAsync(3000);
    await promise;
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.ratio).toBe('1280:720');
  });

  it('generate API error JSON', async () => {
    provider.configure('key');
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized', json: () => Promise.resolve({ error: 'Invalid key' }) });
    await expect(provider.generate({ prompt: 'test' })).rejects.toThrow('Runway API error (401): Invalid key');
  });

  it('generate API error non-JSON', async () => {
    provider.configure('key');
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error', json: () => Promise.reject(new Error()) });
    await expect(provider.generate({ prompt: 'test' })).rejects.toThrow('Runway API error (500): Server Error');
  });

  it('generate poll error JSON', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 't1' }) })
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Err', json: () => Promise.resolve({ error: 'poll fail' }) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(3000);
    await expect(promise).rejects.toThrow('Runway poll error (500): poll fail');
  });

  it('generate poll error non-JSON', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 't1' }) })
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Srv', json: () => Promise.reject(new Error()) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(3000);
    await expect(promise).rejects.toThrow('Runway poll error (500): Srv');
  });

  it('generate task FAILED', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 't1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'FAILED', failure: 'bad content' }) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(3000);
    await expect(promise).rejects.toThrow('Runway task failed: bad content');
  });

  it('generate task FAILED no message', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 't1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'FAILED' }) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(3000);
    await expect(promise).rejects.toThrow('Unknown error');
  });

  it('generate SUCCEEDED no output', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 't1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'SUCCEEDED', output: [] }) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(3000);
    await expect(promise).rejects.toThrow('no output URL');
  });

  it('generate timeout', async () => {
    provider.configure('key');
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 't1' }) });
    for (let i = 0; i < 100; i++) mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'RUNNING' }) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(300000);
    await expect(promise).rejects.toThrow('timed out');
  });

  it('animate throws without key', async () => {
    await expect(provider.animate({ prompt: 'test', inputImage: '/img.png' })).rejects.toThrow('Runway API key not configured');
  });
  it('animate throws without image', async () => {
    provider.configure('key');
    await expect(provider.animate({ prompt: 'test' })).rejects.toThrow('requires an input image');
  });
  it('animate succeeds', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'at1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'SUCCEEDED', output: ['https://cdn/anim.mp4'] }) });
    const promise = provider.animate({ prompt: 'animate', inputImage: '/test.png', aspectRatio: '1:1' });
    await vi.advanceTimersByTimeAsync(3000);
    const result = await promise;
    expect(result.videos[0].url).toBe('https://cdn/anim.mp4');
  });
  it('animate API error', async () => {
    provider.configure('key');
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400, statusText: 'Bad', json: () => Promise.resolve({ error: 'bad image' }) });
    await expect(provider.animate({ prompt: 'test', inputImage: '/img.png' })).rejects.toThrow('Runway API error (400): bad image');
  });
  it('animate API error non-JSON', async () => {
    provider.configure('key');
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Fail', json: () => Promise.reject(new Error()) });
    await expect(provider.animate({ prompt: 'test', inputImage: '/img.png' })).rejects.toThrow('Runway API error (500): Fail');
  });
});

describe('FalProvider', () => {
  let provider: FalProvider;
  beforeEach(() => { provider = new FalProvider(); });

  it('info', () => { expect(provider.info.name).toBe('fal'); expect(provider.info.capabilities.imageToVideo).toBe(true); });
  it('configure / isConfigured', () => { expect(provider.isConfigured()).toBe(false); provider.configure('k'); expect(provider.isConfigured()).toBe(true); });
  it('validate', async () => { expect(await provider.validate()).toBe(false); provider.configure('k'); expect(await provider.validate()).toBe(true); });
  it('listModels', async () => { expect(await provider.listModels()).toEqual(provider.info.supportedModels); });
  it('generate throws without key', async () => { await expect(provider.generate({ prompt: 'test' })).rejects.toThrow('fal.ai API key not configured'); });

  it('generate succeeds', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ request_id: 'r1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'IN_QUEUE' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'COMPLETED' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ video: { url: 'https://cdn/v.mp4' } }) });
    const promise = provider.generate({ prompt: 'test', aspectRatio: '16:9', negativePrompt: 'bad', seed: 42 });
    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;
    expect(result.videos[0].url).toBe('https://cdn/v.mp4');
  });

  it('generate IN_PROGRESS', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ request_id: 'r1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'IN_PROGRESS' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'COMPLETED' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ video: { url: 'url' } }) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersByTimeAsync(5000);
    expect((await promise).videos[0].url).toBe('url');
  });

  it('generate submit error', async () => {
    provider.configure('key');
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauth', json: () => Promise.resolve({ detail: 'bad key' }) });
    await expect(provider.generate({ prompt: 'test' })).rejects.toThrow('fal.ai API error (401): bad key');
  });
  it('generate submit error non-JSON', async () => {
    provider.configure('key');
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Error', json: () => Promise.reject(new Error()) });
    await expect(provider.generate({ prompt: 'test' })).rejects.toThrow('fal.ai API error (500): Error');
  });
  it('generate submit no request_id', async () => {
    provider.configure('key');
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    await expect(provider.generate({ prompt: 'test' })).rejects.toThrow('No request_id');
  });

  it('generate poll error', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ request_id: 'r1' }) })
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Err', json: () => Promise.resolve({ detail: 'poll fail' }) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(5000);
    await expect(promise).rejects.toThrow('fal.ai poll error (500): poll fail');
  });
  it('generate poll error non-JSON', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ request_id: 'r1' }) })
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Srv', json: () => Promise.reject(new Error()) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(5000);
    await expect(promise).rejects.toThrow('fal.ai poll error (500): Srv');
  });
  it('generate poll unknown status', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ request_id: 'r1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'CANCELLED' }) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(5000);
    await expect(promise).rejects.toThrow('failed with status: CANCELLED');
  });
  it('generate poll timeout', async () => {
    provider.configure('key');
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ request_id: 'r1' }) });
    for (let i = 0; i < 120; i++) mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'IN_QUEUE' }) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(600000);
    await expect(promise).rejects.toThrow('timed out after 10 minutes');
  });

  it('generate result error', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ request_id: 'r1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'COMPLETED' }) })
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Err', json: () => Promise.resolve({ detail: 'no result' }) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(5000);
    await expect(promise).rejects.toThrow('fal.ai result error (500): no result');
  });
  it('generate result error non-JSON', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ request_id: 'r1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'COMPLETED' }) })
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Srv', json: () => Promise.reject(new Error()) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(5000);
    await expect(promise).rejects.toThrow('fal.ai result error (500): Srv');
  });

  it('generate result via data.video.url', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ request_id: 'r1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'COMPLETED' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: { video: { url: 'url2' } } }) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(5000);
    expect((await promise).videos[0].url).toBe('url2');
  });
  it('generate result via output.url', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ request_id: 'r1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'COMPLETED' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ output: { url: 'url3' } }) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(5000);
    expect((await promise).videos[0].url).toBe('url3');
  });
  it('generate result no video URL', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ request_id: 'r1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'COMPLETED' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ something: 'else' }) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(5000);
    await expect(promise).rejects.toThrow('No video URL in result');
  });

  it('animate throws without key', async () => { await expect(provider.animate({ prompt: 'test', inputImage: '/img.png' })).rejects.toThrow('fal.ai API key not configured'); });
  it('animate throws without image', async () => { provider.configure('k'); await expect(provider.animate({ prompt: 'test' })).rejects.toThrow('requires an input image'); });
  it('animate succeeds', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ request_id: 'ar1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'COMPLETED' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ video: { url: 'anim-url' } }) });
    const promise = provider.animate({ prompt: 'animate', inputImage: '/test.png', aspectRatio: '16:9', negativePrompt: 'bad', seed: 99 });
    await vi.advanceTimersByTimeAsync(5000);
    expect((await promise).videos[0].url).toBe('anim-url');
  });
});

describe('ReplicateProvider', () => {
  let provider: ReplicateProvider;
  beforeEach(() => { provider = new ReplicateProvider(); });

  it('info', () => { expect(provider.info.name).toBe('replicate'); expect(provider.info.capabilities.imageToVideo).toBe(false); });
  it('configure / isConfigured', () => { expect(provider.isConfigured()).toBe(false); provider.configure('k'); expect(provider.isConfigured()).toBe(true); });
  it('validate false without key', async () => { expect(await provider.validate()).toBe(false); });
  it('validate true', async () => { provider.configure('k'); mockFetch.mockResolvedValueOnce({ ok: true }); expect(await provider.validate()).toBe(true); });
  it('validate false on error', async () => { provider.configure('k'); mockFetch.mockRejectedValueOnce(new Error()); expect(await provider.validate()).toBe(false); });
  it('validate false on non-ok', async () => { provider.configure('k'); mockFetch.mockResolvedValueOnce({ ok: false }); expect(await provider.validate()).toBe(false); });
  it('listModels', async () => { expect(await provider.listModels()).toEqual(provider.info.supportedModels); });
  it('generate throws without key', async () => { await expect(provider.generate({ prompt: 'test' })).rejects.toThrow('Replicate API key not configured'); });
  it('generate throws unknown model', async () => { provider.configure('k'); await expect(provider.generate({ prompt: 'test', model: 'bad/model' })).rejects.toThrow('Unknown Replicate model'); });

  it('generate succeeds with polling', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'p1', status: 'starting', output: null, urls: { get: 'https://api.replicate.com/v1/predictions/p1' } }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'processing', output: null }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'succeeded', output: 'https://cdn/video.mp4' }) });
    const promise = provider.generate({ prompt: 'test', aspectRatio: '16:9', negativePrompt: 'bad', seed: 42 });
    await vi.advanceTimersByTimeAsync(3000);
    await vi.advanceTimersByTimeAsync(3000);
    expect((await promise).videos[0].url).toBe('https://cdn/video.mp4');
  });

  it('generate array output', async () => {
    provider.configure('key');
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'p1', status: 'succeeded', output: ['https://cdn/v.mp4'] }) });
    expect((await provider.generate({ prompt: 'test' })).videos[0].url).toBe('https://cdn/v.mp4');
  });

  it('generate fallback poll URL', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'p1', status: 'starting', output: null }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'succeeded', output: 'url' }) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(3000);
    await promise;
    expect(mockFetch.mock.calls[1][0]).toContain('/predictions/p1');
  });

  it('generate API error', async () => {
    provider.configure('key');
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, statusText: 'U', json: () => Promise.resolve({ detail: 'bad token' }) });
    await expect(provider.generate({ prompt: 'test' })).rejects.toThrow('Replicate API error (401): bad token');
  });
  it('generate API error non-JSON', async () => {
    provider.configure('key');
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Err', json: () => Promise.reject(new Error()) });
    await expect(provider.generate({ prompt: 'test' })).rejects.toThrow('Replicate API error (500): Err');
  });
  it('generate poll error', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'p1', status: 'starting' }) })
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Err', json: () => Promise.resolve({ detail: 'poll fail' }) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(3000);
    await expect(promise).rejects.toThrow('Replicate poll error (500): poll fail');
  });
  it('generate poll error non-JSON', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'p1', status: 'starting' }) })
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Srv', json: () => Promise.reject(new Error()) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(3000);
    await expect(promise).rejects.toThrow('Replicate poll error (500): Srv');
  });
  it('generate prediction failed', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'p1', status: 'starting' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'failed', error: 'NSFW' }) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(3000);
    await expect(promise).rejects.toThrow('Replicate prediction failed: NSFW');
  });
  it('generate prediction failed no msg', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'p1', status: 'starting' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'failed' }) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(3000);
    await expect(promise).rejects.toThrow('Unknown error');
  });
  it('generate timeout', async () => {
    provider.configure('key');
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'p1', status: 'starting' }) });
    for (let i = 0; i < 100; i++) mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'processing' }) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(300000);
    await expect(promise).rejects.toThrow('timed out');
  });
  it('generate no output URL', async () => {
    provider.configure('key');
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'p1', status: 'succeeded', output: null }) });
    await expect(provider.generate({ prompt: 'test' })).rejects.toThrow('No video URL');
  });
});

describe('VeoProvider', () => {
  let provider: VeoProvider;
  beforeEach(() => { provider = new VeoProvider(); });

  it('info', () => { expect(provider.info.name).toBe('veo'); expect(provider.info.capabilities.audioGeneration).toBe(true); });
  it('configure / isConfigured', () => { expect(provider.isConfigured()).toBe(false); provider.configure('k'); expect(provider.isConfigured()).toBe(true); });
  it('validate false without key', async () => { expect(await provider.validate()).toBe(false); });
  it('validate true', async () => { provider.configure('k'); mockFetch.mockResolvedValueOnce({ ok: true }); expect(await provider.validate()).toBe(true); });
  it('validate false on error', async () => { provider.configure('k'); mockFetch.mockRejectedValueOnce(new Error()); expect(await provider.validate()).toBe(false); });
  it('validate false on non-ok', async () => { provider.configure('k'); mockFetch.mockResolvedValueOnce({ ok: false }); expect(await provider.validate()).toBe(false); });
  it('listModels', async () => { expect(await provider.listModels()).toEqual(provider.info.supportedModels); });
  it('generate throws without key', async () => { await expect(provider.generate({ prompt: 'test' })).rejects.toThrow('Veo API key not configured'); });

  it('generate succeeds', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ name: 'operations/op-1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ done: true, response: { generatedVideos: [{ video: { uri: 'https://cdn/veo.mp4' } }] } }) });
    const promise = provider.generate({ prompt: 'test', aspectRatio: '16:9' });
    await vi.advanceTimersByTimeAsync(5000);
    expect((await promise).videos[0].url).toBe('https://cdn/veo.mp4');
  });

  it('generate API error', async () => {
    provider.configure('key');
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403, statusText: 'Forbidden', json: () => Promise.resolve({ error: { message: 'quota exceeded' } }) });
    await expect(provider.generate({ prompt: 'test' })).rejects.toThrow('Veo API error (403): quota exceeded');
  });
  it('generate API error non-JSON', async () => {
    provider.configure('key');
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Err', json: () => Promise.reject(new Error()) });
    await expect(provider.generate({ prompt: 'test' })).rejects.toThrow('Veo API error (500): Err');
  });
  it('generate no operation name', async () => {
    provider.configure('key');
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    await expect(provider.generate({ prompt: 'test' })).rejects.toThrow('No operation name');
  });
  it('generate poll error', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ name: 'operations/op1' }) })
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Err', json: () => Promise.resolve({ error: { message: 'poll fail' } }) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(5000);
    await expect(promise).rejects.toThrow('Veo poll error (500): poll fail');
  });
  it('generate poll error non-JSON', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ name: 'operations/op1' }) })
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Srv', json: () => Promise.reject(new Error()) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(5000);
    await expect(promise).rejects.toThrow('Veo poll error (500): Srv');
  });
  it('generate operation error', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ name: 'operations/op1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ error: { message: 'content policy' } }) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(5000);
    await expect(promise).rejects.toThrow('Veo operation failed: content policy');
  });
  it('generate operation error no msg', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ name: 'operations/op1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ error: {} }) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(5000);
    await expect(promise).rejects.toThrow('Unknown error');
  });
  it('generate done no video URI', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ name: 'operations/op1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ done: true, response: { generatedVideos: [] } }) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(5000);
    await expect(promise).rejects.toThrow('no video URI');
  });
  it('generate timeout', async () => {
    provider.configure('key');
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ name: 'operations/op1' }) });
    for (let i = 0; i < 120; i++) mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ done: false }) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(600000);
    await expect(promise).rejects.toThrow('timed out after 10 minutes');
  });
});

describe('SoraProvider', () => {
  let provider: SoraProvider;
  beforeEach(() => { provider = new SoraProvider(); });

  it('info', () => { expect(provider.info.name).toBe('sora'); expect(provider.info.capabilities.audioGeneration).toBe(true); });
  it('configure / isConfigured', () => { expect(provider.isConfigured()).toBe(false); provider.configure('k'); expect(provider.isConfigured()).toBe(true); });
  it('validate false without key', async () => { expect(await provider.validate()).toBe(false); });
  it('validate true', async () => { provider.configure('k'); mockFetch.mockResolvedValueOnce({ ok: true }); expect(await provider.validate()).toBe(true); });
  it('validate false on error', async () => { provider.configure('k'); mockFetch.mockRejectedValueOnce(new Error()); expect(await provider.validate()).toBe(false); });
  it('validate false on non-ok', async () => { provider.configure('k'); mockFetch.mockResolvedValueOnce({ ok: false }); expect(await provider.validate()).toBe(false); });
  it('listModels', async () => { expect(await provider.listModels()).toEqual(provider.info.supportedModels); });
  it('generate throws without key', async () => { await expect(provider.generate({ prompt: 'test' })).rejects.toThrow('Sora API key not configured'); });

  it('generate succeeds', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'gen-1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'completed', data: [{ url: 'https://cdn/sora.mp4' }] }) });
    const promise = provider.generate({ prompt: 'test', count: 2, aspectRatio: '9:16' });
    await vi.advanceTimersByTimeAsync(5000);
    expect((await promise).videos[0].url).toBe('https://cdn/sora.mp4');
  });

  it('generate clamps duration 8 -> 10', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'g1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'completed', data: [{ url: 'url' }] }) });
    const promise = provider.generate({ prompt: 'test', duration: 8 });
    await vi.advanceTimersByTimeAsync(5000);
    expect((await promise).videos[0].duration).toBe(10);
  });

  it('generate clamps duration 3 -> 5', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'g1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'completed', data: [{ url: 'url' }] }) });
    const promise = provider.generate({ prompt: 'test', duration: 3 });
    await vi.advanceTimersByTimeAsync(5000);
    expect((await promise).videos[0].duration).toBe(5);
  });

  it('generate unknown aspect ratio fallback', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'g1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'completed', data: [{ url: 'url' }] }) });
    const promise = provider.generate({ prompt: 'test', aspectRatio: '99:1' });
    await vi.advanceTimersByTimeAsync(5000);
    await promise;
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.size).toBe('1280x720');
  });

  it('generate API error', async () => {
    provider.configure('key');
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429, statusText: 'Rate', json: () => Promise.resolve({ error: { message: 'rate limited' } }) });
    await expect(provider.generate({ prompt: 'test' })).rejects.toThrow('Sora API error (429): rate limited');
  });
  it('generate API error non-JSON', async () => {
    provider.configure('key');
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Err', json: () => Promise.reject(new Error()) });
    await expect(provider.generate({ prompt: 'test' })).rejects.toThrow('Sora API error (500): Err');
  });
  it('generate no generation ID', async () => {
    provider.configure('key');
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    await expect(provider.generate({ prompt: 'test' })).rejects.toThrow('No generation ID');
  });
  it('generate poll error', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'g1' }) })
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Err', json: () => Promise.resolve({ error: { message: 'poll fail' } }) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(5000);
    await expect(promise).rejects.toThrow('Sora poll error (500): poll fail');
  });
  it('generate poll error non-JSON', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'g1' }) })
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Srv', json: () => Promise.reject(new Error()) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(5000);
    await expect(promise).rejects.toThrow('Sora poll error (500): Srv');
  });
  it('generate failed', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'g1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'failed', error: { message: 'NSFW' } }) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(5000);
    await expect(promise).rejects.toThrow('Sora generation failed: NSFW');
  });
  it('generate failed no msg', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'g1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'failed' }) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(5000);
    await expect(promise).rejects.toThrow('Unknown error');
  });
  it('generate completed no URLs', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'g1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'completed', data: [] }) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(5000);
    await expect(promise).rejects.toThrow('no video URLs');
  });
  it('generate completed null URLs', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'g1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'completed', data: [{ url: null }] }) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(5000);
    await expect(promise).rejects.toThrow('no video URLs');
  });
  it('generate timeout', async () => {
    provider.configure('key');
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'g1' }) });
    for (let i = 0; i < 120; i++) mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'processing' }) });
    const promise = provider.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(600000);
    await expect(promise).rejects.toThrow('timed out after 10 minutes');
  });
  it('generate multiple videos', async () => {
    provider.configure('key');
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'g1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: 'completed', data: [{ url: 'u1' }, { url: 'u2' }] }) });
    const promise = provider.generate({ prompt: 'test', count: 2 });
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;
    expect(result.videos).toHaveLength(2);
  });
});
