const PRICING: Record<string, Record<string, number>> = {
  runway: {
    'gen4_turbo': 0.05,
    'gen4': 0.12,
    'gen4.5': 0.15,
  },
  fal: {
    'fal-ai/kling-video/v2.5/standard/text-to-video': 0.07,
    'fal-ai/veo3': 0.40,
    'fal-ai/luma-dream-machine/ray-2': 0.10,
    'fal-ai/sora-2/text-to-video': 0.10,
  },
  replicate: {
    'kwaivgi/kling-v1.5-standard': 0.05,
    'wan-ai/wan-2.1-t2v': 0.08,
  },
  veo: {
    'veo-3.1-fast-generate-001': 0.15,
    'veo-3.1-generate-001': 0.40,
  },
  sora: {
    'sora-2': 0.10,
    'sora-2-pro': 0.30,
  },
};

export function estimateCost(provider: string, model: string, durationSeconds: number): number {
  const providerPricing = PRICING[provider] || {};
  const ratePerSecond = providerPricing[model] || 0;
  return ratePerSecond * durationSeconds;
}

export function getProviderPricing(provider: string): Record<string, number> {
  return PRICING[provider] || {};
}

export function getAllPricing(): Record<string, Record<string, number>> {
  return { ...PRICING };
}
