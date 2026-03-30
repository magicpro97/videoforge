export interface PriceEntry {
  rate: number;
  unit: 'second' | 'generation';
}

const PRICING: Record<string, Record<string, PriceEntry>> = {
  runway: {
    'gen4_turbo': { rate: 0.05, unit: 'second' },
    'gen4': { rate: 0.05, unit: 'second' },
    'gen4.5': { rate: 0.10, unit: 'second' },
  },
  fal: {
    'fal-ai/kling-video/v2.5/standard/text-to-video': { rate: 0.065, unit: 'generation' },
    'fal-ai/veo3': { rate: 0.50, unit: 'generation' },
    'fal-ai/luma-dream-machine/ray-2': { rate: 0.30, unit: 'generation' },
    'fal-ai/sora-2/text-to-video': { rate: 0.40, unit: 'generation' },
  },
  replicate: {
    'kwaivgi/kling-v1.5-standard': { rate: 0.032, unit: 'second' },
    'wan-ai/wan-2.1-t2v': { rate: 0.025, unit: 'second' },
  },
  veo: {
    'veo-3.1-fast-generate-001': { rate: 0.025, unit: 'second' },
    'veo-3.1-generate-001': { rate: 0.060, unit: 'second' },
  },
  sora: {
    'sora-2': { rate: 0.20, unit: 'generation' },
    'sora-2-pro': { rate: 0.80, unit: 'generation' },
  },
};

export function estimateCost(provider: string, model: string, durationSeconds: number): number {
  const entry = PRICING[provider]?.[model];
  if (!entry) return 0;
  return entry.unit === 'generation' ? entry.rate : entry.rate * durationSeconds;
}

export function getProviderPricing(provider: string): Record<string, PriceEntry> {
  return PRICING[provider] || {};
}

export function getAllPricing(): Record<string, Record<string, PriceEntry>> {
  return { ...PRICING };
}
