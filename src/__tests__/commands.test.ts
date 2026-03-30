import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock external modules
vi.mock('node:fs');
vi.mock('node:child_process');

vi.mock('chalk', () => ({
  default: {
    red: (s: string) => s, green: (s: string) => s, yellow: (s: string) => s,
    dim: (s: string) => s, bold: (s: string) => s, cyan: (s: string) => s,
  },
}));

let mockSpinner: any;
vi.mock('ora', () => {
  mockSpinner = {
    start: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
    stop: vi.fn(),
    text: '',
  };
  mockSpinner.start.mockReturnValue(mockSpinner);
  mockSpinner.succeed.mockReturnValue(mockSpinner);
  mockSpinner.fail.mockReturnValue(mockSpinner);
  mockSpinner.stop.mockReturnValue(mockSpinner);
  return { default: () => mockSpinner };
});

vi.mock('inquirer', () => ({
  default: { prompt: vi.fn().mockResolvedValue({ confirm: true }) },
}));

vi.mock('yaml', () => ({ default: { parse: vi.fn() } }));

// Mock core modules
vi.mock('../core/config.js');
vi.mock('../core/history.js');
vi.mock('../core/output.js');
vi.mock('../core/presets.js');
vi.mock('../core/resolutions.js');
vi.mock('../core/pricing.js');
vi.mock('../core/templates.js');
vi.mock('../core/opener.js');
vi.mock('../providers/index.js');

import * as fs from 'node:fs';
import { execSync } from 'node:child_process';
import yaml from 'yaml';

import { loadConfig, getConfigValue, setConfigValue, getConfigPath } from '../core/config.js';
import { loadHistory, addHistoryEntry, clearHistory, getHistoryEntry } from '../core/history.js';
import { generateFilename, ensureOutputDir, downloadVideo, saveVideoFile } from '../core/output.js';
import { applyPreset, STYLE_PRESETS } from '../core/presets.js';
import { getResolution } from '../core/resolutions.js';
import { estimateCost, getAllPricing, getProviderPricing } from '../core/pricing.js';
import { loadTemplates, addTemplate, removeTemplate, getTemplate, renderTemplate } from '../core/templates.js';
import { openFile } from '../core/opener.js';
import { createProvider, getAllProviderNames } from '../providers/index.js';

import { createGenerateCommand } from '../cli/commands/generate.js';
import { createAnimateCommand } from '../cli/commands/animate.js';
import { createConfigCommand } from '../cli/commands/config.js';
import { createProvidersCommand } from '../cli/commands/providers.js';
import { createHistoryCommand } from '../cli/commands/history.js';
import { createTemplateCommand } from '../cli/commands/template.js';
import { createBatchCommand } from '../cli/commands/batch.js';
import { createCompareCommand } from '../cli/commands/compare.js';
import { createCostCommand } from '../cli/commands/cost.js';
import { createConvertCommand } from '../cli/commands/convert.js';

const mockProvider = {
  info: {
    name: 'runway', displayName: 'Runway (Gen-4)', website: 'https://runwayml.com/',
    requiresApiKey: true, defaultModel: 'gen4_turbo', supportedModels: ['gen4_turbo'],
    capabilities: { textToVideo: true, imageToVideo: true, videoEditing: false, audioGeneration: false, variations: false },
    pricing: { currency: 'USD', unit: 'second', rates: { gen4_turbo: 0.05 } },
  },
  configure: vi.fn(),
  isConfigured: vi.fn().mockReturnValue(true),
  generate: vi.fn().mockResolvedValue({
    videos: [{ url: 'https://cdn/video.mp4', duration: 5 }],
    provider: 'runway', model: 'gen4_turbo', elapsed: 5000,
  }),
  animate: vi.fn().mockResolvedValue({
    videos: [{ url: 'https://cdn/anim.mp4', duration: 5 }],
    provider: 'runway', model: 'gen4_turbo', elapsed: 3000,
  }),
  listModels: vi.fn().mockResolvedValue(['gen4_turbo']),
  validate: vi.fn().mockResolvedValue(true),
};

let exitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // Restore spinner mock (mockReset: true clears it between tests)
  if (mockSpinner) {
    mockSpinner.start = vi.fn().mockReturnValue(mockSpinner);
    mockSpinner.succeed = vi.fn().mockReturnValue(mockSpinner);
    mockSpinner.fail = vi.fn().mockReturnValue(mockSpinner);
    mockSpinner.stop = vi.fn().mockReturnValue(mockSpinner);
  }
  vi.mocked(loadConfig).mockReturnValue({});
  vi.mocked(getConfigValue).mockReturnValue(undefined);
  vi.mocked(getConfigPath).mockReturnValue('/mock/.videoforge/config.json');
  vi.mocked(createProvider).mockReturnValue(mockProvider as any);
  vi.mocked(getAllProviderNames).mockReturnValue(['runway', 'fal', 'replicate', 'veo', 'sora']);
  vi.mocked(estimateCost).mockReturnValue(0.25);
  vi.mocked(generateFilename).mockReturnValue('/out/video.mp4');
  vi.mocked(ensureOutputDir).mockImplementation(() => {});
  vi.mocked(downloadVideo).mockResolvedValue('/out/video.mp4');
  vi.mocked(saveVideoFile).mockReturnValue('/out/video.mp4');
  vi.mocked(addHistoryEntry).mockImplementation(() => {});
  vi.mocked(openFile).mockImplementation(() => {});
  vi.mocked(getResolution).mockReturnValue(undefined);
  vi.mocked(getTemplate).mockReturnValue(undefined);
  vi.mocked(renderTemplate).mockReturnValue('rendered prompt');
  vi.mocked(applyPreset).mockImplementation((p: string) => p + ', cinematic');
  vi.mocked(loadHistory).mockReturnValue([]);
  vi.mocked(loadTemplates).mockReturnValue([]);
  vi.mocked(getAllPricing).mockReturnValue({ runway: { gen4_turbo: { rate: 0.05, unit: 'second' } } } as any);
  vi.mocked(getProviderPricing).mockReturnValue({ gen4_turbo: 0.05 });
  vi.mocked(fs.existsSync).mockReturnValue(true);
  vi.mocked(fs.readFileSync).mockReturnValue('[]' as any);
  vi.mocked(fs.statSync).mockReturnValue({ size: 1024 * 1024 } as any);
  vi.mocked(execSync).mockReturnValue(Buffer.from(''));
  mockProvider.isConfigured.mockReturnValue(true);
  mockProvider.generate.mockResolvedValue({
    videos: [{ url: 'https://cdn/video.mp4', duration: 5 }],
    provider: 'runway', model: 'gen4_turbo', elapsed: 5000,
  });
  mockProvider.animate.mockResolvedValue({
    videos: [{ url: 'https://cdn/anim.mp4', duration: 5 }],
    provider: 'runway', model: 'gen4_turbo', elapsed: 3000,
  });
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit'); }) as any);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // Make STYLE_PRESETS available
  (STYLE_PRESETS as any)['cinematic'] = { suffix: 'cinematic' };
});

// ── generate command ──────────────────────────────────────────────

describe('generate command', () => {
  it('generates successfully with URL download', async () => {
    vi.mocked(getConfigValue).mockReturnValue('test-api-key');
    const cmd = createGenerateCommand();
    await cmd.parseAsync(['node', 'test', 'a flying cat']);
    expect(mockProvider.generate).toHaveBeenCalled();
    expect(downloadVideo).toHaveBeenCalled();
  });

  it('generates with base64 video', async () => {
    vi.mocked(getConfigValue).mockReturnValue('test-key');
    mockProvider.generate.mockResolvedValueOnce({
      videos: [{ base64: 'dGVzdA==', duration: 5 }],
      provider: 'runway', model: 'gen4_turbo', elapsed: 5000,
    });
    const cmd = createGenerateCommand();
    await cmd.parseAsync(['node', 'test', 'test prompt']);
    expect(saveVideoFile).toHaveBeenCalled();
  });

  it('generates with localPath video', async () => {
    vi.mocked(getConfigValue).mockReturnValue('test-key');
    mockProvider.generate.mockResolvedValueOnce({
      videos: [{ localPath: '/tmp/video.mp4', duration: 5 }],
      provider: 'runway', model: 'gen4_turbo', elapsed: 5000,
    });
    const cmd = createGenerateCommand();
    await cmd.parseAsync(['node', 'test', 'test']);
    expect(downloadVideo).not.toHaveBeenCalled();
  });

  it('exits when no API key', async () => {
    mockProvider.isConfigured.mockReturnValue(false);
    const cmd = createGenerateCommand();
    await expect(cmd.parseAsync(['node', 'test', 'test'])).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits on generation error', async () => {
    vi.mocked(getConfigValue).mockReturnValue('test-key');
    mockProvider.generate.mockRejectedValueOnce(new Error('API failed'));
    const cmd = createGenerateCommand();
    await expect(cmd.parseAsync(['node', 'test', 'test'])).rejects.toThrow('process.exit');
  });

  it('uses template when provided', async () => {
    vi.mocked(getConfigValue).mockReturnValue('test-key');
    vi.mocked(getTemplate).mockReturnValue({ name: 'tmpl', prompt: 'hello {subject}', provider: 'fal', duration: 10, resolution: '1080p', preset: 'cinematic' });
    const cmd = createGenerateCommand();
    await cmd.parseAsync(['node', 'test', 'ignored', '-t', 'tmpl', '--var', 'subject=cats']);
    expect(renderTemplate).toHaveBeenCalled();
  });

  it('exits when template not found', async () => {
    vi.mocked(getTemplate).mockReturnValue(undefined);
    const cmd = createGenerateCommand();
    await expect(cmd.parseAsync(['node', 'test', 'test', '-t', 'missing'])).rejects.toThrow('process.exit');
  });

  it('applies style preset', async () => {
    vi.mocked(getConfigValue).mockReturnValue('test-key');
    const cmd = createGenerateCommand();
    await cmd.parseAsync(['node', 'test', 'a cat', '-s', 'cinematic']);
    expect(applyPreset).toHaveBeenCalled();
  });

  it('passes resolution option', async () => {
    vi.mocked(getConfigValue).mockReturnValue('test-key');
    vi.mocked(getResolution).mockReturnValue({ label: '1080p', width: 1920, height: 1080 } as any);
    const cmd = createGenerateCommand();
    await cmd.parseAsync(['node', 'test', 'test', '-r', '1080p']);
    expect(getResolution).toHaveBeenCalledWith('1080p');
  });

  it('opens file when --open', async () => {
    vi.mocked(getConfigValue).mockReturnValue('test-key');
    const cmd = createGenerateCommand();
    await cmd.parseAsync(['node', 'test', 'test', '--open']);
    expect(openFile).toHaveBeenCalled();
  });

  it('handles no video data in response', async () => {
    vi.mocked(getConfigValue).mockReturnValue('test-key');
    mockProvider.generate.mockResolvedValueOnce({
      videos: [{}], provider: 'runway', model: 'gen4_turbo', elapsed: 5000,
    });
    const cmd = createGenerateCommand();
    await expect(cmd.parseAsync(['node', 'test', 'test'])).rejects.toThrow('process.exit');
  });

  it('handles multiple videos with custom output', async () => {
    vi.mocked(getConfigValue).mockReturnValue('test-key');
    mockProvider.generate.mockResolvedValueOnce({
      videos: [
        { url: 'https://cdn/v1.mp4', duration: 5 },
        { url: 'https://cdn/v2.mp4', duration: 5 },
      ],
      provider: 'runway', model: 'gen4_turbo', elapsed: 5000,
    });
    const cmd = createGenerateCommand();
    await cmd.parseAsync(['node', 'test', 'test', '-o', '/out/video.mp4', '-n', '2']);
    expect(downloadVideo).toHaveBeenCalledTimes(2);
  });

  it('skips history when disabled', async () => {
    vi.mocked(getConfigValue).mockReturnValue('test-key');
    vi.mocked(loadConfig).mockReturnValue({ history: { enabled: false } });
    const cmd = createGenerateCommand();
    await cmd.parseAsync(['node', 'test', 'test']);
    expect(addHistoryEntry).not.toHaveBeenCalled();
  });
});

// ── animate command ───────────────────────────────────────────────

describe('animate command', () => {
  it('animates successfully', async () => {
    vi.mocked(getConfigValue).mockReturnValue('test-key');
    const cmd = createAnimateCommand();
    await cmd.parseAsync(['node', 'test', '/input.png', 'motion prompt']);
    expect(mockProvider.animate).toHaveBeenCalled();
  });

  it('exits when image not found', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const cmd = createAnimateCommand();
    await expect(cmd.parseAsync(['node', 'test', '/missing.png'])).rejects.toThrow('process.exit');
  });

  it('exits when provider does not support imageToVideo', async () => {
    vi.mocked(getConfigValue).mockReturnValue('test-key');
    const noImgProvider = { ...mockProvider, info: { ...mockProvider.info, capabilities: { ...mockProvider.info.capabilities, imageToVideo: false } } };
    vi.mocked(createProvider).mockReturnValue(noImgProvider as any);
    const cmd = createAnimateCommand();
    await expect(cmd.parseAsync(['node', 'test', '/input.png'])).rejects.toThrow('process.exit');
  });

  it('exits when no API key', async () => {
    mockProvider.isConfigured.mockReturnValue(false);
    const cmd = createAnimateCommand();
    await expect(cmd.parseAsync(['node', 'test', '/input.png'])).rejects.toThrow('process.exit');
  });

  it('exits on animate error', async () => {
    vi.mocked(getConfigValue).mockReturnValue('test-key');
    mockProvider.animate.mockRejectedValueOnce(new Error('animate failed'));
    const cmd = createAnimateCommand();
    await expect(cmd.parseAsync(['node', 'test', '/input.png'])).rejects.toThrow('process.exit');
  });

  it('handles base64 video result', async () => {
    vi.mocked(getConfigValue).mockReturnValue('test-key');
    mockProvider.animate.mockResolvedValueOnce({
      videos: [{ base64: 'dGVzdA==', duration: 5 }],
      provider: 'runway', model: 'gen4_turbo', elapsed: 3000,
    });
    const cmd = createAnimateCommand();
    await cmd.parseAsync(['node', 'test', '/input.png']);
    expect(saveVideoFile).toHaveBeenCalled();
  });

  it('handles localPath video result', async () => {
    vi.mocked(getConfigValue).mockReturnValue('test-key');
    mockProvider.animate.mockResolvedValueOnce({
      videos: [{ localPath: '/tmp/v.mp4', duration: 5 }],
      provider: 'runway', model: 'gen4_turbo', elapsed: 3000,
    });
    const cmd = createAnimateCommand();
    await cmd.parseAsync(['node', 'test', '/input.png']);
  });

  it('handles no video data', async () => {
    vi.mocked(getConfigValue).mockReturnValue('test-key');
    mockProvider.animate.mockResolvedValueOnce({
      videos: [{}], provider: 'runway', model: 'gen4_turbo', elapsed: 3000,
    });
    const cmd = createAnimateCommand();
    await expect(cmd.parseAsync(['node', 'test', '/input.png'])).rejects.toThrow('process.exit');
  });
});

// ── config command ────────────────────────────────────────────────

describe('config command', () => {
  it('config set works', async () => {
    const cmd = createConfigCommand();
    await cmd.parseAsync(['node', 'test', 'set', 'runway.apiKey', 'test-key']);
    expect(setConfigValue).toHaveBeenCalled();
  });

  it('config set normalizes default keys', async () => {
    const cmd = createConfigCommand();
    await cmd.parseAsync(['node', 'test', 'set', 'provider', 'fal']);
    expect(setConfigValue).toHaveBeenCalledWith('defaults.provider', 'fal');
  });

  it('config set masks sensitive keys', async () => {
    const cmd = createConfigCommand();
    await cmd.parseAsync(['node', 'test', 'set', 'runway.apiKey', 'very-long-api-key-12345']);
    // Should still set the value
    expect(setConfigValue).toHaveBeenCalled();
  });

  it('config get found value', async () => {
    vi.mocked(getConfigValue).mockReturnValue('some-value');
    const cmd = createConfigCommand();
    await cmd.parseAsync(['node', 'test', 'get', 'runway.apiKey']);
  });

  it('config get object value', async () => {
    vi.mocked(getConfigValue).mockReturnValue({ key: 'val' });
    const cmd = createConfigCommand();
    await cmd.parseAsync(['node', 'test', 'get', 'runway']);
  });

  it('config get not found', async () => {
    vi.mocked(getConfigValue).mockReturnValue(undefined);
    const cmd = createConfigCommand();
    await cmd.parseAsync(['node', 'test', 'get', 'missing']);
  });

  it('config list', async () => {
    vi.mocked(loadConfig).mockReturnValue({
      runway: { apiKey: 'test-key' },
      defaults: { provider: 'runway', duration: 10, resolution: '1080p', aspectRatio: '16:9', format: 'webm', preset: 'cinematic' },
      output: { directory: '/out', autoOpen: true },
      history: { enabled: true, maxEntries: 50 },
    });
    const cmd = createConfigCommand();
    await cmd.parseAsync(['node', 'test', 'list']);
  });

  it('config list with empty config', async () => {
    vi.mocked(loadConfig).mockReturnValue({});
    const cmd = createConfigCommand();
    await cmd.parseAsync(['node', 'test', 'list']);
  });
});

// ── providers command ─────────────────────────────────────────────

describe('providers command', () => {
  it('providers list', async () => {
    const cmd = createProvidersCommand();
    await cmd.parseAsync(['node', 'test', 'list']);
    expect(getAllProviderNames).toHaveBeenCalled();
  });

  it('providers list with configured key', async () => {
    vi.mocked(getConfigValue).mockReturnValue('some-key');
    const cmd = createProvidersCommand();
    await cmd.parseAsync(['node', 'test', 'list']);
  });

  it('providers list with non-requiring key provider', async () => {
    const freeProvider = { ...mockProvider, info: { ...mockProvider.info, requiresApiKey: false } };
    vi.mocked(createProvider).mockReturnValue(freeProvider as any);
    const cmd = createProvidersCommand();
    await cmd.parseAsync(['node', 'test', 'list']);
  });
});

// ── history command ───────────────────────────────────────────────

describe('history command', () => {
  it('history list with entries', async () => {
    vi.mocked(loadHistory).mockReturnValue([
      { id: 'h1', timestamp: '2024-01-01T00:00:00Z', provider: 'runway', model: 'gen4', prompt: 'a cat', duration: 5, cost: 0.25 },
    ] as any);
    const cmd = createHistoryCommand();
    await cmd.parseAsync(['node', 'test', 'list']);
  });

  it('history list empty', async () => {
    const cmd = createHistoryCommand();
    await cmd.parseAsync(['node', 'test', 'list']);
  });

  it('history show found', async () => {
    vi.mocked(loadHistory).mockReturnValue([
      { id: 'h1-full-uuid', timestamp: '2024-01-01T00:00:00Z', provider: 'runway', model: 'gen4', prompt: 'a cat', duration: 5, cost: 0.25, resolution: '1080p', outputPath: '/out/v.mp4' },
    ] as any);
    const cmd = createHistoryCommand();
    await cmd.parseAsync(['node', 'test', 'show', 'h1']);
  });

  it('history show not found', async () => {
    const cmd = createHistoryCommand();
    await expect(cmd.parseAsync(['node', 'test', 'show', 'missing'])).rejects.toThrow('process.exit');
  });

  it('history clear with confirm', async () => {
    vi.mocked(loadHistory).mockReturnValue([{ id: 'h1' }] as any);
    const inquirer = await import('inquirer');
    vi.mocked(inquirer.default.prompt).mockResolvedValueOnce({ confirm: true });
    const cmd = createHistoryCommand();
    await cmd.parseAsync(['node', 'test', 'clear']);
    expect(clearHistory).toHaveBeenCalled();
  });

  it('history clear cancelled', async () => {
    vi.mocked(loadHistory).mockReturnValue([{ id: 'h1' }] as any);
    const inquirer = await import('inquirer');
    vi.mocked(inquirer.default.prompt).mockResolvedValueOnce({ confirm: false });
    const cmd = createHistoryCommand();
    await cmd.parseAsync(['node', 'test', 'clear']);
    expect(clearHistory).not.toHaveBeenCalled();
  });

  it('history clear empty', async () => {
    const cmd = createHistoryCommand();
    await cmd.parseAsync(['node', 'test', 'clear']);
    expect(clearHistory).not.toHaveBeenCalled();
  });
});

// ── template command ──────────────────────────────────────────────

describe('template command', () => {
  it('template save', async () => {
    const cmd = createTemplateCommand();
    await cmd.parseAsync(['node', 'test', 'save', 'tmpl1', 'hello world', '-p', 'fal', '-d', '10']);
    expect(addTemplate).toHaveBeenCalled();
  });

  it('template list with templates', async () => {
    vi.mocked(loadTemplates).mockReturnValue([
      { name: 'tmpl1', prompt: 'hello {subject}', provider: 'fal', duration: 10, resolution: '1080p', preset: 'cinematic' },
    ] as any);
    const cmd = createTemplateCommand();
    await cmd.parseAsync(['node', 'test', 'list']);
  });

  it('template list empty', async () => {
    const cmd = createTemplateCommand();
    await cmd.parseAsync(['node', 'test', 'list']);
  });

  it('template use found', async () => {
    vi.mocked(getTemplate).mockReturnValue({ name: 'tmpl1', prompt: 'hello {subject}' } as any);
    vi.mocked(renderTemplate).mockReturnValue('hello cats');
    const cmd = createTemplateCommand();
    await cmd.parseAsync(['node', 'test', 'use', 'tmpl1', '--var', 'subject=cats']);
  });

  it('template use not found', async () => {
    vi.mocked(getTemplate).mockReturnValue(undefined);
    const cmd = createTemplateCommand();
    await expect(cmd.parseAsync(['node', 'test', 'use', 'missing'])).rejects.toThrow('process.exit');
  });

  it('template remove found', async () => {
    vi.mocked(removeTemplate).mockReturnValue(true);
    const cmd = createTemplateCommand();
    await cmd.parseAsync(['node', 'test', 'remove', 'tmpl1']);
  });

  it('template remove not found', async () => {
    vi.mocked(removeTemplate).mockReturnValue(false);
    const cmd = createTemplateCommand();
    await expect(cmd.parseAsync(['node', 'test', 'remove', 'missing'])).rejects.toThrow('process.exit');
  });
});

// ── batch command ─────────────────────────────────────────────────

describe('batch command', () => {
  it('batch dry run', async () => {
    vi.mocked(yaml.parse).mockReturnValue({ items: [{ prompt: 'test video', provider: 'runway' }] });
    const cmd = createBatchCommand();
    await cmd.parseAsync(['node', 'test', '/batch.yml', '--dry-run']);
  });

  it('batch generates', async () => {
    vi.mocked(yaml.parse).mockReturnValue([{ prompt: 'test video' }]);
    vi.mocked(getConfigValue).mockReturnValue('test-key');
    const cmd = createBatchCommand();
    await cmd.parseAsync(['node', 'test', '/batch.yml']);
    expect(mockProvider.generate).toHaveBeenCalled();
  });

  it('batch file not found', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const cmd = createBatchCommand();
    await expect(cmd.parseAsync(['node', 'test', '/missing.yml'])).rejects.toThrow('process.exit');
  });

  it('batch parse error', async () => {
    vi.mocked(yaml.parse).mockImplementation(() => { throw new Error('bad yaml'); });
    const cmd = createBatchCommand();
    await expect(cmd.parseAsync(['node', 'test', '/bad.yml'])).rejects.toThrow('process.exit');
  });

  it('batch empty items', async () => {
    vi.mocked(yaml.parse).mockReturnValue({ items: [] });
    const cmd = createBatchCommand();
    await expect(cmd.parseAsync(['node', 'test', '/empty.yml'])).rejects.toThrow('process.exit');
  });

  it('batch item failure continues', async () => {
    vi.mocked(yaml.parse).mockReturnValue([{ prompt: 'test1' }, { prompt: 'test2' }]);
    vi.mocked(getConfigValue).mockReturnValue('test-key');
    mockProvider.generate
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({
        videos: [{ url: 'https://cdn/v.mp4', duration: 5 }],
        provider: 'runway', model: 'gen4_turbo', elapsed: 5000,
      });
    const cmd = createBatchCommand();
    await cmd.parseAsync(['node', 'test', '/batch.yml']);
  });

  it('batch with base64 video', async () => {
    vi.mocked(yaml.parse).mockReturnValue([{ prompt: 'test', preset: 'cinematic' }]);
    vi.mocked(getConfigValue).mockReturnValue('key');
    mockProvider.generate.mockResolvedValueOnce({
      videos: [{ base64: 'dGVzdA==', duration: 5 }],
      provider: 'runway', model: 'gen4_turbo', elapsed: 5000,
    });
    const cmd = createBatchCommand();
    await cmd.parseAsync(['node', 'test', '/batch.yml']);
    expect(saveVideoFile).toHaveBeenCalled();
  });

  it('batch with localPath video', async () => {
    vi.mocked(yaml.parse).mockReturnValue([{ prompt: 'test', output: '/custom/out.mp4' }]);
    vi.mocked(getConfigValue).mockReturnValue('key');
    mockProvider.generate.mockResolvedValueOnce({
      videos: [{ localPath: '/tmp/v.mp4', duration: 5 }],
      provider: 'runway', model: 'gen4_turbo', elapsed: 5000,
    });
    const cmd = createBatchCommand();
    await cmd.parseAsync(['node', 'test', '/batch.yml']);
  });

  it('batch no video data', async () => {
    vi.mocked(yaml.parse).mockReturnValue([{ prompt: 'test' }]);
    vi.mocked(getConfigValue).mockReturnValue('key');
    mockProvider.generate.mockResolvedValueOnce({
      videos: [{}], provider: 'runway', model: 'gen4_turbo', elapsed: 5000,
    });
    const cmd = createBatchCommand();
    await cmd.parseAsync(['node', 'test', '/batch.yml']);
    // Should fail gracefully and continue
  });

  it('batch no API key throws', async () => {
    vi.mocked(yaml.parse).mockReturnValue([{ prompt: 'test' }]);
    mockProvider.isConfigured.mockReturnValue(false);
    vi.mocked(getConfigValue).mockReturnValue(undefined);
    const cmd = createBatchCommand();
    await cmd.parseAsync(['node', 'test', '/batch.yml']);
    // Error caught per-item, batch continues
  });

  it('batch JSON file', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue('[{"prompt":"test"}]' as any);
    vi.mocked(getConfigValue).mockReturnValue('key');
    const cmd = createBatchCommand();
    await cmd.parseAsync(['node', 'test', '/batch.json']);
    expect(mockProvider.generate).toHaveBeenCalled();
  });

  it('batch with videos key', async () => {
    vi.mocked(yaml.parse).mockReturnValue({ videos: [{ prompt: 'test' }] });
    vi.mocked(getConfigValue).mockReturnValue('key');
    const cmd = createBatchCommand();
    await cmd.parseAsync(['node', 'test', '/batch.yml']);
  });
});

// ── compare command ───────────────────────────────────────────────

describe('compare command', () => {
  it('compare with explicit providers', async () => {
    vi.mocked(getConfigValue).mockReturnValue('key');
    const cmd = createCompareCommand();
    await cmd.parseAsync(['node', 'test', 'a cat', '--providers', 'runway,fal']);
    expect(mockProvider.generate).toHaveBeenCalledTimes(2);
  });

  it('compare auto-detect configured', async () => {
    vi.mocked(getConfigValue).mockImplementation((key: string) => {
      if (key === 'runway.apiKey') return 'key1';
      if (key === 'fal.apiKey') return 'key2';
      return undefined;
    });
    const cmd = createCompareCommand();
    await cmd.parseAsync(['node', 'test', 'a cat']);
  });

  it('compare no providers', async () => {
    vi.mocked(getConfigValue).mockReturnValue(undefined);
    mockProvider.isConfigured.mockReturnValue(false);
    const cmd = createCompareCommand();
    await expect(cmd.parseAsync(['node', 'test', 'test'])).rejects.toThrow('process.exit');
  });

  it('compare less than 2 providers', async () => {
    vi.mocked(getConfigValue).mockImplementation((key: string) => {
      if (key === 'runway.apiKey') return 'key1';
      return undefined;
    });
    const cmd = createCompareCommand();
    await expect(cmd.parseAsync(['node', 'test', 'test'])).rejects.toThrow('process.exit');
  });

  it('compare one provider fails', async () => {
    vi.mocked(getConfigValue).mockReturnValue('key');
    mockProvider.generate
      .mockResolvedValueOnce({ videos: [{ url: 'url1', duration: 5 }], provider: 'runway', model: 'gen4_turbo', elapsed: 5000 })
      .mockRejectedValueOnce(new Error('fal failed'));
    const cmd = createCompareCommand();
    await cmd.parseAsync(['node', 'test', 'test', '--providers', 'runway,fal']);
  });

  it('compare with base64 video', async () => {
    vi.mocked(getConfigValue).mockReturnValue('key');
    mockProvider.generate
      .mockResolvedValueOnce({ videos: [{ base64: 'dGVzdA==', duration: 5 }], provider: 'runway', model: 'gen4_turbo', elapsed: 5000 })
      .mockResolvedValueOnce({ videos: [{ localPath: '/tmp/v.mp4', duration: 5 }], provider: 'fal', model: 'model', elapsed: 3000 });
    const cmd = createCompareCommand();
    await cmd.parseAsync(['node', 'test', 'test', '--providers', 'runway,fal']);
  });

  it('compare with no video data', async () => {
    vi.mocked(getConfigValue).mockReturnValue('key');
    mockProvider.generate
      .mockResolvedValueOnce({ videos: [{}], provider: 'runway', model: 'gen4_turbo', elapsed: 5000 })
      .mockResolvedValueOnce({ videos: [{ url: 'url', duration: 5 }], provider: 'fal', model: 'model', elapsed: 3000 });
    const cmd = createCompareCommand();
    await cmd.parseAsync(['node', 'test', 'test', '--providers', 'runway,fal']);
  });

  it('compare with output dir', async () => {
    vi.mocked(getConfigValue).mockReturnValue('key');
    const cmd = createCompareCommand();
    await cmd.parseAsync(['node', 'test', 'test', '--providers', 'runway,fal', '-o', '/outdir']);
  });
});

// ── cost command ──────────────────────────────────────────────────

describe('cost command', () => {
  it('cost summary with entries', async () => {
    vi.mocked(loadHistory).mockReturnValue([
      { id: 'h1', provider: 'runway', cost: 0.25, duration: 5 },
      { id: 'h2', provider: 'fal', cost: 0.50, duration: 10 },
    ] as any);
    const cmd = createCostCommand();
    await cmd.parseAsync(['node', 'test', 'summary']);
  });

  it('cost summary empty', async () => {
    const cmd = createCostCommand();
    await cmd.parseAsync(['node', 'test', 'summary']);
  });

  it('cost pricing', async () => {
    const cmd = createCostCommand();
    await cmd.parseAsync(['node', 'test', 'pricing']);
    expect(getAllPricing).toHaveBeenCalled();
  });

  it('cost pricing with empty pricing', async () => {
    vi.mocked(getAllPricing).mockReturnValue({ runway: {} });
    const cmd = createCostCommand();
    await cmd.parseAsync(['node', 'test', 'pricing']);
  });
});

// ── convert command ───────────────────────────────────────────────

describe('convert command', () => {
  it('converts mp4 successfully', async () => {
    const cmd = createConvertCommand();
    await cmd.parseAsync(['node', 'test', '/input.mp4', '--to', 'mp4']);
    expect(execSync).toHaveBeenCalled();
  });

  it('converts webm', async () => {
    const cmd = createConvertCommand();
    await cmd.parseAsync(['node', 'test', '/input.mp4', '--to', 'webm']);
  });

  it('converts gif', async () => {
    const cmd = createConvertCommand();
    await cmd.parseAsync(['node', 'test', '/input.mp4', '--to', 'gif']);
  });

  it('converts gif with fps', async () => {
    const cmd = createConvertCommand();
    await cmd.parseAsync(['node', 'test', '/input.mp4', '--to', 'gif', '--fps', '30']);
  });

  it('file not found', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const cmd = createConvertCommand();
    await expect(cmd.parseAsync(['node', 'test', '/missing.mp4'])).rejects.toThrow('process.exit');
  });

  it('ffmpeg not available', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(execSync).mockImplementationOnce(() => { throw new Error('not found'); });
    const cmd = createConvertCommand();
    await expect(cmd.parseAsync(['node', 'test', '/input.mp4'])).rejects.toThrow('process.exit');
  });

  it('conversion failure', async () => {
    vi.mocked(execSync)
      .mockReturnValueOnce(Buffer.from('')) // ffmpeg -version
      .mockImplementationOnce(() => { throw Object.assign(new Error('fail'), { stderr: Buffer.from('encoding error') }); });
    const cmd = createConvertCommand();
    await expect(cmd.parseAsync(['node', 'test', '/input.mp4'])).rejects.toThrow('process.exit');
  });

  it('resize with preset', async () => {
    const cmd = createConvertCommand();
    await cmd.parseAsync(['node', 'test', '/input.mp4', '--resize', '720p']);
  });

  it('resize with custom WxH', async () => {
    const cmd = createConvertCommand();
    await cmd.parseAsync(['node', 'test', '/input.mp4', '--resize', '1920x1080']);
  });

  it('resize invalid', async () => {
    const cmd = createConvertCommand();
    await expect(cmd.parseAsync(['node', 'test', '/input.mp4', '--resize', 'invalid'])).rejects.toThrow('process.exit');
  });

  it('with output path', async () => {
    const cmd = createConvertCommand();
    await cmd.parseAsync(['node', 'test', '/input.mp4', '-o', '/out/converted.mp4']);
  });

  it('with fps option', async () => {
    const cmd = createConvertCommand();
    await cmd.parseAsync(['node', 'test', '/input.mp4', '--fps', '60']);
  });
});
