import { VideoProvider } from './base.js';
import type { VideoGenerationRequest, VideoGenerationResult, ProviderInfo } from '../types/index.js';

const SIZE_MAP: Record<string, string> = {
  '16:9': '1280x720',
  '9:16': '720x1280',
  '1:1': '1024x1024',
  '21:9': '1792x1024',
};

const VALID_DURATIONS = [5, 10, 15, 20];

function clampDuration(duration: number): number {
  let closest = VALID_DURATIONS[0];
  let minDiff = Math.abs(duration - closest);
  for (const d of VALID_DURATIONS) {
    const diff = Math.abs(duration - d);
    if (diff < minDiff) {
      closest = d;
      minDiff = diff;
    }
  }
  return closest;
}

export class SoraProvider extends VideoProvider {
  private apiKey: string = '';
  private baseUrl = 'https://api.openai.com/v1';

  get info(): ProviderInfo {
    return {
      name: 'sora',
      displayName: 'OpenAI Sora',
      description: 'OpenAI Sora text-to-video generation with audio support',
      website: 'https://openai.com/sora',
      requiresApiKey: true,
      defaultModel: 'sora-2',
      supportedModels: ['sora-2', 'sora-2-pro'],
      capabilities: {
        textToVideo: true,
        imageToVideo: false,
        videoEditing: false,
        audioGeneration: true,
        variations: false,
      },
      pricing: {
        currency: 'USD',
        unit: 'generation',
        rates: { 'sora-2': 0.20, 'sora-2-pro': 0.80 },
      },
    };
  }

  configure(apiKey: string): void {
    this.apiKey = apiKey;
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async validate(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async generate(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
    if (!this.apiKey) {
      throw new Error('Sora API key not configured. Run: videoforge config set sora.apiKey <key>');
    }

    const startTime = Date.now();
    const model = request.model || 'sora-2';
    const duration = clampDuration(request.duration || 10);
    const size = SIZE_MAP[request.aspectRatio || '16:9'] || '1280x720';
    const n = request.count || 1;

    const body: Record<string, unknown> = {
      model,
      prompt: request.prompt,
      size,
      duration,
      n,
    };

    const response = await fetch(`${this.baseUrl}/videos/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg = (errorData as { error?: { message?: string } })?.error?.message || response.statusText;
      throw new Error(`Sora API error (${response.status}): ${msg}`);
    }

    const generation = await response.json() as { id: string };
    if (!generation.id) {
      throw new Error('Sora: No generation ID in response');
    }

    const videos = await this.pollGeneration(generation.id);
    const elapsed = Date.now() - startTime;

    return {
      videos: videos.map(url => ({ url, duration })),
      provider: 'sora',
      model,
      elapsed,
      metadata: { generationId: generation.id },
    };
  }

  async listModels(): Promise<string[]> {
    return this.info.supportedModels;
  }

  private async pollGeneration(generationId: string): Promise<string[]> {
    const pollInterval = 5000;
    const maxWait = 600000;
    let waited = 0;

    while (waited < maxWait) {
      await new Promise(r => setTimeout(r, pollInterval));
      waited += pollInterval;

      const response = await fetch(`${this.baseUrl}/videos/generations/${generationId}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = (errorData as { error?: { message?: string } })?.error?.message || response.statusText;
        throw new Error(`Sora poll error (${response.status}): ${msg}`);
      }

      const result = await response.json() as {
        status: string;
        data?: Array<{ url?: string }>;
        error?: { message?: string };
      };

      if (result.status === 'completed') {
        const urls = result.data
          ?.map(item => item.url)
          .filter((url): url is string => !!url);

        if (!urls || urls.length === 0) {
          throw new Error('Sora: Generation completed but no video URLs returned');
        }
        return urls;
      }

      if (result.status === 'failed') {
        throw new Error(`Sora generation failed: ${result.error?.message || 'Unknown error'}`);
      }
    }

    throw new Error('Sora generation timed out after 10 minutes');
  }
}
