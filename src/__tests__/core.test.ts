import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('node:fs');
vi.mock('node:os');
vi.mock('node:child_process');
vi.mock('node:crypto');

import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';
import { platform } from 'node:os';

import {
  getConfigDir,
  getConfigPath,
  loadConfig,
  saveConfig,
  getConfigValue,
  setConfigValue,
  parseValue,
} from '../core/config.js';

import {
  getHistoryPath,
  loadHistory,
  saveHistory,
  addHistoryEntry,
  clearHistory,
  getHistoryEntry,
} from '../core/history.js';

import {
  generateFilename,
  ensureOutputDir,
  saveVideoFile,
  downloadVideo,
} from '../core/output.js';

import {
  STYLE_PRESETS,
  applyPreset,
  getPresetNames,
} from '../core/presets.js';

import {
  RESOLUTION_PRESETS,
  getResolution,
  getResolutionNames,
  getAspectRatio,
} from '../core/resolutions.js';

import {
  estimateCost,
  getProviderPricing,
  getAllPricing,
} from '../core/pricing.js';

import {
  getTemplatesPath,
  loadTemplates,
  saveTemplates,
  addTemplate,
  removeTemplate,
  getTemplate,
  renderTemplate,
} from '../core/templates.js';

import { openFile } from '../core/opener.js';

// ─── Global mock setup ──────────────────────────────────────────────

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

beforeEach(() => {
  vi.mocked(os.homedir).mockReturnValue('/mock/home');
  vi.mocked(platform).mockReturnValue('linux');
  vi.mocked(crypto.randomUUID).mockReturnValue('test-uuid-1234' as `${string}-${string}-${string}-${string}-${string}`);

  vi.mocked(fs.existsSync).mockImplementation((p: any) => {
    const filePath = String(p);
    if (filePath.includes('config.json')) return true;
    if (filePath.includes('history.json')) return true;
    if (filePath.includes('templates.json')) return true;
    return false;
  });

  vi.mocked(fs.readFileSync).mockImplementation((p: any) => {
    const filePath = String(p);
    if (filePath.includes('config.json'))
      return JSON.stringify({ runway: { apiKey: 'test-key' } });
    if (filePath.includes('history.json'))
      return JSON.stringify([
        { id: 'h1', timestamp: '2024-01-01', provider: 'runway', model: 'gen4', prompt: 'test', duration: 5 },
      ]);
    if (filePath.includes('templates.json'))
      return JSON.stringify([{ name: 'tmpl1', prompt: 'test {var}' }]);
    return '';
  });

  vi.mocked(fs.writeFileSync).mockImplementation(() => {});
  vi.mocked(fs.mkdirSync).mockImplementation(() => '' as any);
  mockFetch.mockReset();
});

// ─── config.ts ──────────────────────────────────────────────────────

describe('config', () => {
  describe('getConfigDir', () => {
    it('returns ~/.videoforge', () => {
      expect(getConfigDir()).toBe('/mock/home/.videoforge');
    });
  });

  describe('getConfigPath', () => {
    it('returns config.json inside config dir', () => {
      expect(getConfigPath()).toBe('/mock/home/.videoforge/config.json');
    });
  });

  describe('loadConfig', () => {
    it('reads and parses config file', () => {
      const config = loadConfig();
      expect(config).toEqual({ runway: { apiKey: 'test-key' } });
      expect(fs.readFileSync).toHaveBeenCalledWith(
        '/mock/home/.videoforge/config.json',
        'utf-8',
      );
    });

    it('returns empty object on read error', () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('ENOENT');
      });
      expect(loadConfig()).toEqual({});
    });

    it('returns empty object on invalid JSON', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('not-json');
      expect(loadConfig()).toEqual({});
    });
  });

  describe('saveConfig', () => {
    it('creates directory if it does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      saveConfig({ runway: { apiKey: 'k' } });
      expect(fs.mkdirSync).toHaveBeenCalledWith('/mock/home/.videoforge', { recursive: true });
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('skips mkdir when directory already exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      saveConfig({});
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it('writes formatted JSON', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const config = { runway: { apiKey: 'abc' } };
      saveConfig(config);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/mock/home/.videoforge/config.json',
        JSON.stringify(config, null, 2),
        'utf-8',
      );
    });
  });

  describe('getConfigValue', () => {
    it('returns top-level value', () => {
      expect(getConfigValue('runway')).toEqual({ apiKey: 'test-key' });
    });

    it('returns nested value via dot-notation', () => {
      expect(getConfigValue('runway.apiKey')).toBe('test-key');
    });

    it('returns undefined for missing key', () => {
      expect(getConfigValue('nonexistent')).toBeUndefined();
    });

    it('returns undefined for deep missing key', () => {
      expect(getConfigValue('runway.missing.deep')).toBeUndefined();
    });

    it('returns undefined when traversal hits a primitive', () => {
      expect(getConfigValue('runway.apiKey.nope')).toBeUndefined();
    });

    it('returns undefined when traversal hits null', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ a: null }));
      expect(getConfigValue('a.b')).toBeUndefined();
    });
  });

  describe('setConfigValue', () => {
    it('sets a top-level value', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      setConfigValue('provider', 'runway');
      const written = JSON.parse(
        vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
      );
      expect(written.provider).toBe('runway');
    });

    it('sets a nested value, creating intermediate objects', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      setConfigValue('fal.apiKey', 'fal-key');
      const written = JSON.parse(
        vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
      );
      expect(written.fal.apiKey).toBe('fal-key');
    });

    it('overwrites existing primitive intermediate with object', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ a: 'string' }));
      vi.mocked(fs.existsSync).mockReturnValue(true);
      setConfigValue('a.b', 'val');
      const written = JSON.parse(
        vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
      );
      expect(written.a.b).toBe('val');
    });

    it('overwrites null intermediate with object', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ a: null }));
      vi.mocked(fs.existsSync).mockReturnValue(true);
      setConfigValue('a.b', 'val');
      const written = JSON.parse(
        vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
      );
      expect(written.a.b).toBe('val');
    });
  });

  describe('parseValue', () => {
    it('parses "true" to boolean true', () => {
      expect(parseValue('true')).toBe(true);
    });

    it('parses "false" to boolean false', () => {
      expect(parseValue('false')).toBe(false);
    });

    it('parses "null" to null', () => {
      expect(parseValue('null')).toBe(null);
    });

    it('parses integer string to number', () => {
      expect(parseValue('42')).toBe(42);
    });

    it('parses float string to number', () => {
      expect(parseValue('3.14')).toBe(3.14);
    });

    it('parses "0" to number 0', () => {
      expect(parseValue('0')).toBe(0);
    });

    it('returns string for non-numeric text', () => {
      expect(parseValue('hello')).toBe('hello');
    });

    it('returns string for empty string', () => {
      expect(parseValue('')).toBe('');
    });

    it('returns string for whitespace-only', () => {
      expect(parseValue('   ')).toBe('   ');
    });
  });
});

// ─── history.ts ─────────────────────────────────────────────────────

describe('history', () => {
  describe('getHistoryPath', () => {
    it('returns history.json inside config dir', () => {
      expect(getHistoryPath()).toBe('/mock/home/.videoforge/history.json');
    });
  });

  describe('loadHistory', () => {
    it('reads and parses history file', () => {
      const history = loadHistory();
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe('h1');
    });

    it('returns empty array on read error', () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('ENOENT');
      });
      expect(loadHistory()).toEqual([]);
    });

    it('returns empty array on invalid JSON', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('{bad');
      expect(loadHistory()).toEqual([]);
    });
  });

  describe('saveHistory', () => {
    it('creates directory if it does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      saveHistory([]);
      expect(fs.mkdirSync).toHaveBeenCalledWith('/mock/home/.videoforge', { recursive: true });
    });

    it('skips mkdir when directory exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      saveHistory([]);
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it('writes JSON to history path', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const entries = [{ id: 'a', timestamp: 't', provider: 'p', model: 'm', prompt: 'pr', duration: 1 }];
      saveHistory(entries);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/mock/home/.videoforge/history.json',
        JSON.stringify(entries, null, 2),
        'utf-8',
      );
    });
  });

  describe('addHistoryEntry', () => {
    it('generates UUID and timestamp, unshifts to existing entries', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const result = addHistoryEntry({
        provider: 'fal',
        model: 'veo3',
        prompt: 'a dog',
        duration: 10,
      });
      expect(result.id).toBe('test-uuid-1234');
      expect(result.timestamp).toBeDefined();
      expect(result.provider).toBe('fal');

      const written = JSON.parse(
        vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
      );
      expect(written[0].id).toBe('test-uuid-1234');
      expect(written[1].id).toBe('h1');
    });
  });

  describe('clearHistory', () => {
    it('saves empty array', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      clearHistory();
      const written = JSON.parse(
        vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
      );
      expect(written).toEqual([]);
    });
  });

  describe('getHistoryEntry', () => {
    it('returns entry by id', () => {
      const entry = getHistoryEntry('h1');
      expect(entry).toBeDefined();
      expect(entry!.provider).toBe('runway');
    });

    it('returns undefined for non-existent id', () => {
      expect(getHistoryEntry('nope')).toBeUndefined();
    });
  });
});

// ─── output.ts ──────────────────────────────────────────────────────

describe('output', () => {
  describe('generateFilename', () => {
    it('sanitizes prompt and includes provider and timestamp', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
      const name = generateFilename('runway', 'A Beautiful Sunset!!! Over the ocean waves crashing gently', 'mp4');
      expect(name).toBe('videoforge-runway-a-beautiful-sunset-over-the-ocean-1700000000000.mp4');
      vi.restoreAllMocks();
    });

    it('handles short prompts', () => {
      vi.spyOn(Date, 'now').mockReturnValue(123);
      const name = generateFilename('fal', 'cat', 'webm');
      expect(name).toBe('videoforge-fal-cat-123.webm');
      vi.restoreAllMocks();
    });

    it('handles prompts with only special characters', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1);
      const name = generateFilename('veo', '!!!@@@', 'mp4');
      expect(name).toBe('videoforge-veo--1.mp4');
      vi.restoreAllMocks();
    });
  });

  describe('ensureOutputDir', () => {
    it('creates directory when it does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      ensureOutputDir('/out/videos');
      expect(fs.mkdirSync).toHaveBeenCalledWith('/out/videos', { recursive: true });
    });

    it('does not create directory when it exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      ensureOutputDir('/out/videos');
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('saveVideoFile', () => {
    it('ensures parent dir and writes buffer', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const buf = Buffer.from('video-data');
      const result = saveVideoFile(buf, '/out/videos/clip.mp4');
      expect(fs.mkdirSync).toHaveBeenCalledWith('/out/videos', { recursive: true });
      expect(fs.writeFileSync).toHaveBeenCalledWith('/out/videos/clip.mp4', buf);
      expect(result).toBe('/out/videos/clip.mp4');
    });

    it('skips mkdir when parent dir exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      saveVideoFile(Buffer.from('data'), '/existing/clip.mp4');
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('downloadVideo', () => {
    it('downloads and saves video', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(64)),
      });

      const result = await downloadVideo('https://example.com/video.mp4', '/out/clip.mp4');
      expect(result).toBe('/out/clip.mp4');
      expect(fs.writeFileSync).toHaveBeenCalled();
      const writtenBuf = vi.mocked(fs.writeFileSync).mock.calls[0][1];
      expect(Buffer.isBuffer(writtenBuf)).toBe(true);
    });

    it('creates directory when it does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      });

      await downloadVideo('https://example.com/v.mp4', '/new/dir/v.mp4');
      expect(fs.mkdirSync).toHaveBeenCalledWith('/new/dir', { recursive: true });
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(downloadVideo('https://example.com/missing.mp4', '/out/f.mp4')).rejects.toThrow(
        'Failed to download video: 404 Not Found',
      );
    });
  });
});

// ─── presets.ts ──────────────────────────────────────────────────────

describe('presets', () => {
  describe('STYLE_PRESETS', () => {
    it('contains 15 presets', () => {
      expect(Object.keys(STYLE_PRESETS)).toHaveLength(15);
    });

    it('all presets have non-empty string values', () => {
      for (const [key, val] of Object.entries(STYLE_PRESETS)) {
        expect(typeof val).toBe('string');
        expect(val.length).toBeGreaterThan(0);
      }
    });
  });

  describe('applyPreset', () => {
    it('appends preset suffix to prompt', () => {
      const result = applyPreset('a sunset', 'cinematic');
      expect(result).toBe(`a sunset, ${STYLE_PRESETS['cinematic']}`);
    });

    it('returns prompt unchanged for unknown preset', () => {
      expect(applyPreset('a sunset', 'nonexistent')).toBe('a sunset');
    });

    it('works with all known presets', () => {
      for (const name of getPresetNames()) {
        const result = applyPreset('test', name);
        expect(result).toContain(', ');
        expect(result.startsWith('test, ')).toBe(true);
      }
    });
  });

  describe('getPresetNames', () => {
    it('returns array of all preset keys', () => {
      const names = getPresetNames();
      expect(names).toContain('cinematic');
      expect(names).toContain('anime');
      expect(names).toContain('watercolor');
      expect(names).toHaveLength(15);
    });
  });
});

// ─── resolutions.ts ─────────────────────────────────────────────────

describe('resolutions', () => {
  describe('RESOLUTION_PRESETS', () => {
    it('contains 11 presets', () => {
      expect(Object.keys(RESOLUTION_PRESETS)).toHaveLength(11);
    });

    it('all presets have width, height, and label', () => {
      for (const res of Object.values(RESOLUTION_PRESETS)) {
        expect(res.width).toBeGreaterThan(0);
        expect(res.height).toBeGreaterThan(0);
        expect(res.label.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getResolution', () => {
    it('returns resolution for known name', () => {
      const res = getResolution('1080p');
      expect(res).toEqual({ width: 1920, height: 1080, label: '1080p (Full HD)' });
    });

    it('is case-insensitive', () => {
      expect(getResolution('4K')).toEqual(getResolution('4k'));
    });

    it('returns undefined for unknown name', () => {
      expect(getResolution('8k')).toBeUndefined();
    });
  });

  describe('getResolutionNames', () => {
    it('returns all resolution keys', () => {
      const names = getResolutionNames();
      expect(names).toContain('1080p');
      expect(names).toContain('phone');
      expect(names).toContain('og-video');
      expect(names).toHaveLength(11);
    });
  });

  describe('getAspectRatio', () => {
    it('returns 16:9 for 1080p', () => {
      expect(getAspectRatio('1080p')).toBe('16:9');
    });

    it('returns 16:9 for youtube', () => {
      expect(getAspectRatio('youtube')).toBe('16:9');
    });

    it('returns 1:1 for square', () => {
      expect(getAspectRatio('square')).toBe('1:1');
    });

    it('returns 9:16 for phone', () => {
      expect(getAspectRatio('phone')).toBe('9:16');
    });

    it('returns 9:16 for tiktok', () => {
      expect(getAspectRatio('tiktok')).toBe('9:16');
    });

    it('is case-insensitive', () => {
      expect(getAspectRatio('SQUARE')).toBe('1:1');
    });

    it('returns 16:9 for unknown resolution', () => {
      expect(getAspectRatio('nonexistent')).toBe('16:9');
    });

    it('calculates GCD-based ratio for og-video', () => {
      // 1200x630 → GCD=30 → 40:21
      expect(getAspectRatio('og-video')).toBe('40:21');
    });

    it('calculates ratio for tablet', () => {
      // 1024x1366 → GCD=2 → 512:683
      expect(getAspectRatio('tablet')).toBe('512:683');
    });

    it('calculates ratio for 480p', () => {
      // 854x480 → GCD=2 → 427:240
      expect(getAspectRatio('480p')).toBe('427:240');
    });

    it('calculates ratio for 720p', () => {
      // 1280x720 → GCD=80 → 16:9
      expect(getAspectRatio('720p')).toBe('16:9');
    });
  });
});

// ─── pricing.ts ─────────────────────────────────────────────────────

describe('pricing', () => {
  describe('estimateCost', () => {
    it('calculates cost for known provider and model', () => {
      expect(estimateCost('runway', 'gen4', 10)).toBeCloseTo(1.2);
    });

    it('returns 0 for unknown provider', () => {
      expect(estimateCost('unknown', 'model', 10)).toBe(0);
    });

    it('returns 0 for unknown model', () => {
      expect(estimateCost('runway', 'nonexistent', 10)).toBe(0);
    });

    it('returns 0 for zero duration', () => {
      expect(estimateCost('runway', 'gen4', 0)).toBe(0);
    });

    it('handles fal provider pricing', () => {
      expect(estimateCost('fal', 'fal-ai/veo3', 5)).toBeCloseTo(2.0);
    });

    it('handles replicate provider pricing', () => {
      expect(estimateCost('replicate', 'wan-ai/wan-2.1-t2v', 10)).toBeCloseTo(0.8);
    });

    it('handles veo provider pricing', () => {
      expect(estimateCost('veo', 'veo-3.1-generate-001', 5)).toBeCloseTo(2.0);
    });

    it('handles sora provider pricing', () => {
      expect(estimateCost('sora', 'sora-2', 10)).toBeCloseTo(1.0);
    });
  });

  describe('getProviderPricing', () => {
    it('returns pricing map for known provider', () => {
      const pricing = getProviderPricing('runway');
      expect(pricing['gen4']).toBe(0.12);
      expect(pricing['gen4_turbo']).toBe(0.05);
    });

    it('returns empty object for unknown provider', () => {
      expect(getProviderPricing('unknown')).toEqual({});
    });
  });

  describe('getAllPricing', () => {
    it('returns a copy of all pricing data', () => {
      const all = getAllPricing();
      expect(all.runway).toBeDefined();
      expect(all.fal).toBeDefined();
      expect(all.replicate).toBeDefined();
      expect(all.veo).toBeDefined();
      expect(all.sora).toBeDefined();
    });

    it('returns a shallow copy (not the same reference)', () => {
      const a = getAllPricing();
      const b = getAllPricing();
      expect(a).not.toBe(b);
    });
  });
});

// ─── templates.ts ───────────────────────────────────────────────────

describe('templates', () => {
  describe('getTemplatesPath', () => {
    it('returns templates.json inside config dir', () => {
      expect(getTemplatesPath()).toBe('/mock/home/.videoforge/templates.json');
    });
  });

  describe('loadTemplates', () => {
    it('reads and parses templates file', () => {
      const templates = loadTemplates();
      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe('tmpl1');
    });

    it('returns empty array on read error', () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('ENOENT');
      });
      expect(loadTemplates()).toEqual([]);
    });

    it('returns empty array on invalid JSON', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('bad json');
      expect(loadTemplates()).toEqual([]);
    });
  });

  describe('saveTemplates', () => {
    it('creates directory if it does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      saveTemplates([]);
      expect(fs.mkdirSync).toHaveBeenCalledWith('/mock/home/.videoforge', { recursive: true });
    });

    it('skips mkdir when directory exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      saveTemplates([]);
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it('writes JSON to templates path', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const entries = [{ name: 'a', prompt: 'b' }];
      saveTemplates(entries);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/mock/home/.videoforge/templates.json',
        JSON.stringify(entries, null, 2),
        'utf-8',
      );
    });
  });

  describe('addTemplate', () => {
    it('pushes new template when name does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      addTemplate({ name: 'new-tmpl', prompt: 'new prompt' });
      const written = JSON.parse(
        vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
      );
      expect(written).toHaveLength(2);
      expect(written[1].name).toBe('new-tmpl');
    });

    it('replaces existing template with same name', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      addTemplate({ name: 'tmpl1', prompt: 'updated prompt' });
      const written = JSON.parse(
        vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
      );
      expect(written).toHaveLength(1);
      expect(written[0].prompt).toBe('updated prompt');
    });
  });

  describe('removeTemplate', () => {
    it('removes existing template and returns true', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const result = removeTemplate('tmpl1');
      expect(result).toBe(true);
      const written = JSON.parse(
        vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
      );
      expect(written).toHaveLength(0);
    });

    it('returns false when template not found', () => {
      const result = removeTemplate('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('getTemplate', () => {
    it('returns template by name', () => {
      const tmpl = getTemplate('tmpl1');
      expect(tmpl).toBeDefined();
      expect(tmpl!.prompt).toBe('test {var}');
    });

    it('returns undefined for non-existent name', () => {
      expect(getTemplate('nope')).toBeUndefined();
    });
  });

  describe('renderTemplate', () => {
    it('replaces {key} placeholders with values', () => {
      const result = renderTemplate(
        { name: 't', prompt: 'Hello {name}, welcome to {place}' },
        { name: 'Alice', place: 'Wonderland' },
      );
      expect(result).toBe('Hello Alice, welcome to Wonderland');
    });

    it('leaves unmatched placeholders intact', () => {
      const result = renderTemplate(
        { name: 't', prompt: '{a} and {b}' },
        { a: 'X' },
      );
      expect(result).toBe('X and {b}');
    });

    it('replaces all occurrences of same key', () => {
      const result = renderTemplate(
        { name: 't', prompt: '{x} {x} {x}' },
        { x: 'Y' },
      );
      expect(result).toBe('Y Y Y');
    });

    it('handles empty variables', () => {
      const result = renderTemplate(
        { name: 't', prompt: 'no vars here' },
        {},
      );
      expect(result).toBe('no vars here');
    });
  });
});

// ─── opener.ts ──────────────────────────────────────────────────────

describe('opener', () => {
  describe('openFile', () => {
    it('uses xdg-open on linux', () => {
      vi.mocked(platform).mockReturnValue('linux');
      openFile('/path/to/video.mp4');
      expect(exec).toHaveBeenCalledWith('xdg-open "/path/to/video.mp4"');
    });

    it('uses open on darwin', () => {
      vi.mocked(platform).mockReturnValue('darwin');
      openFile('/path/to/video.mp4');
      expect(exec).toHaveBeenCalledWith('open "/path/to/video.mp4"');
    });

    it('uses start on win32', () => {
      vi.mocked(platform).mockReturnValue('win32');
      openFile('C:\\video.mp4');
      expect(exec).toHaveBeenCalledWith('start "" "C:\\video.mp4"');
    });

    it('defaults to xdg-open for unknown platforms', () => {
      vi.mocked(platform).mockReturnValue('freebsd');
      openFile('/video.mp4');
      expect(exec).toHaveBeenCalledWith('xdg-open "/video.mp4"');
    });
  });
});
