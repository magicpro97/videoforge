import { VideoProvider } from './base.js';
import type { VideoGenerationRequest, VideoGenerationResult, ProviderInfo } from '../types/index.js';

const MODEL_VERSIONS: Record<string, string> = {
  'kwaivgi/kling-v1.5-standard': 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
  'wan-ai/wan-2.1-t2v': 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3',
};

export class ReplicateProvider extends VideoProvider {
  private apiKey: string = '';
  private baseUrl = 'https://api.replicate.com/v1';

  get info(): ProviderInfo {
    return {
      name: 'replicate',
      displayName: 'Replicate (Kling / Wan)',
      description: 'Video generation via Replicate — Kling, Wan, and community models',
      website: 'https://replicate.com/',
      requiresApiKey: true,
      defaultModel: 'kwaivgi/kling-v1.5-standard',
      supportedModels: ['kwaivgi/kling-v1.5-standard', 'wan-ai/wan-2.1-t2v'],
      capabilities: {
        textToVideo: true,
        imageToVideo: false,
        videoEditing: false,
        audioGeneration: false,
        variations: false,
      },
      pricing: {
        currency: 'USD',
        unit: 'second',
        rates: { 'kwaivgi/kling-v1.5-standard': 0.032, 'wan-ai/wan-2.1-t2v': 0.025 },
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
      const response = await fetch(`${this.baseUrl}/account`, {
        headers: { Authorization: `Token ${this.apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async generate(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
    if (!this.apiKey) {
      throw new Error('Replicate API key not configured. Run: videoforge config set replicate.apiKey <key>');
    }

    const startTime = Date.now();
    const model = request.model || 'kwaivgi/kling-v1.5-standard';
    const duration = request.duration || 5;
    const version = MODEL_VERSIONS[model];

    if (!version) {
      throw new Error(`Unknown Replicate model: ${model}. Available: ${Object.keys(MODEL_VERSIONS).join(', ')}`);
    }

    const input: Record<string, unknown> = {
      prompt: request.prompt,
      duration,
    };

    if (request.aspectRatio) {
      input.aspect_ratio = request.aspectRatio;
    }
    if (request.negativePrompt) {
      input.negative_prompt = request.negativePrompt;
    }
    if (request.seed !== undefined) {
      input.seed = request.seed;
    }

    const createResponse = await fetch(`${this.baseUrl}/predictions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${this.apiKey}`,
      },
      body: JSON.stringify({ version, input }),
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json().catch(() => ({}));
      const msg = (errorData as Record<string, string>)?.detail || createResponse.statusText;
      throw new Error(`Replicate API error (${createResponse.status}): ${msg}`);
    }

    const prediction = await createResponse.json() as {
      id: string;
      status: string;
      output?: string | string[];
      urls?: { get?: string };
    };

    let status = prediction.status;
    let output = prediction.output;
    const pollUrl = prediction.urls?.get || `${this.baseUrl}/predictions/${prediction.id}`;

    const pollInterval = 3000;
    const maxWait = 300000;
    let waited = 0;

    while (status !== 'succeeded' && status !== 'failed' && waited < maxWait) {
      await new Promise(r => setTimeout(r, pollInterval));
      waited += pollInterval;

      const pollResponse = await fetch(pollUrl, {
        headers: { Authorization: `Token ${this.apiKey}` },
      });

      if (!pollResponse.ok) {
        const errorData = await pollResponse.json().catch(() => ({}));
        const msg = (errorData as Record<string, string>)?.detail || pollResponse.statusText;
        throw new Error(`Replicate poll error (${pollResponse.status}): ${msg}`);
      }

      const pollData = await pollResponse.json() as {
        status: string;
        output?: string | string[];
        error?: string;
      };

      status = pollData.status;
      output = pollData.output;

      if (status === 'failed') {
        throw new Error(`Replicate prediction failed: ${pollData.error || 'Unknown error'}`);
      }
    }

    if (status !== 'succeeded') {
      throw new Error('Replicate prediction timed out after 5 minutes');
    }

    const videoUrl = typeof output === 'string' ? output : output?.[0];
    if (!videoUrl) {
      throw new Error('Replicate: No video URL in prediction output');
    }

    const elapsed = Date.now() - startTime;

    return {
      videos: [{ url: videoUrl, duration }],
      provider: 'replicate',
      model,
      elapsed,
      metadata: { predictionId: prediction.id },
    };
  }

  async listModels(): Promise<string[]> {
    return this.info.supportedModels;
  }
}
