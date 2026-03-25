export interface Resolution {
  width: number;
  height: number;
  label: string;
}

export const RESOLUTION_PRESETS: Record<string, Resolution> = {
  '480p': { width: 854, height: 480, label: '480p (SD)' },
  '720p': { width: 1280, height: 720, label: '720p (HD)' },
  '1080p': { width: 1920, height: 1080, label: '1080p (Full HD)' },
  '4k': { width: 3840, height: 2160, label: '4K (Ultra HD)' },
  'phone': { width: 1080, height: 1920, label: 'Phone (9:16)' },
  'tablet': { width: 1024, height: 1366, label: 'Tablet (3:4)' },
  'square': { width: 1080, height: 1080, label: 'Square (1:1)' },
  'story': { width: 1080, height: 1920, label: 'Story (9:16)' },
  'youtube': { width: 1920, height: 1080, label: 'YouTube (16:9)' },
  'tiktok': { width: 1080, height: 1920, label: 'TikTok (9:16)' },
  'og-video': { width: 1200, height: 630, label: 'Open Graph' },
};

export function getResolution(name: string): Resolution | undefined {
  return RESOLUTION_PRESETS[name.toLowerCase()];
}

export function getResolutionNames(): string[] {
  return Object.keys(RESOLUTION_PRESETS);
}

export function getAspectRatio(resolution: string): string {
  const res = RESOLUTION_PRESETS[resolution.toLowerCase()];
  if (!res) return '16:9';
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const d = gcd(res.width, res.height);
  return `${res.width / d}:${res.height / d}`;
}
