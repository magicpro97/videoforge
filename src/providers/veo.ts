import { VideoProvider } from './base.js';
import type { VideoGenerationRequest, VideoGenerationResult, ProviderInfo } from '../types/index.js';

export class VeoProvider extends VideoProvider {
  private apiKey: string = '';
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  get info(): ProviderInfo {
    return {
      name: 'veo',
      displayName: 'Google Veo (Gemini API)',
      description: 'Google Veo video generation via Gemini API with audio support',
      website: 'https://deepmind.google/technologies/veo/',
      requiresApiKey: true,
      defaultModel: 'veo-3.1-fast-generate-001',
      supportedModels: ['veo-3.1-fast-generate-001', 'veo-3.1-generate-001'],
      capabilities: {
        textToVideo: true,
        imageToVideo: false,
        videoEditing: false,
        audioGeneration: true,
        variations: false,
      },
      pricing: {
        currency: 'USD',
        unit: 'second',
        rates: { 'veo-3.1-fast-generate-001': 0.025, 'veo-3.1-generate-001': 0.060 },
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
      const response = await fetch(
        `${this.baseUrl}/models?key=${this.apiKey}`,
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  async generate(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
    if (!this.apiKey) {
      throw new Error('Veo API key not configured. Run: videoforge config set veo.apiKey <key>');
    }

    const startTime = Date.now();
    const model = request.model || 'veo-3.1-fast-generate-001';
    const duration = request.duration || 5;

    const parameters: Record<string, unknown> = {
      durationSeconds: duration,
    };

    if (request.aspectRatio) {
      parameters.aspectRatio = request.aspectRatio;
    }

    const body = {
      instances: [{ prompt: request.prompt }],
      parameters,
    };

    const response = await fetch(
      `${this.baseUrl}/models/${model}:predictLongRunning?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg = (errorData as { error?: { message?: string } })?.error?.message || response.statusText;
      throw new Error(`Veo API error (${response.status}): ${msg}`);
    }

    const operation = await response.json() as { name: string };
    if (!operation.name) {
      throw new Error('Veo: No operation name in response');
    }

    const operationId = operation.name.replace('operations/', '');
    const videoUrl = await this.pollOperation(operationId);
    const elapsed = Date.now() - startTime;

    return {
      videos: [{ url: videoUrl, duration }],
      provider: 'veo',
      model,
      elapsed,
      metadata: { operationId: operation.name },
    };
  }

  async listModels(): Promise<string[]> {
    return this.info.supportedModels;
  }

  private async pollOperation(operationId: string): Promise<string> {
    const pollInterval = 5000;
    const maxWait = 600000;
    let waited = 0;

    while (waited < maxWait) {
      await new Promise(r => setTimeout(r, pollInterval));
      waited += pollInterval;

      const response = await fetch(
        `${this.baseUrl}/operations/${operationId}?key=${this.apiKey}`,
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = (errorData as { error?: { message?: string } })?.error?.message || response.statusText;
        throw new Error(`Veo poll error (${response.status}): ${msg}`);
      }

      const result = await response.json() as {
        done?: boolean;
        error?: { message?: string };
        response?: {
          generatedVideos?: Array<{ video?: { uri?: string } }>;
        };
      };

      if (result.error) {
        throw new Error(`Veo operation failed: ${result.error.message || 'Unknown error'}`);
      }

      if (result.done) {
        const videoUri = result.response?.generatedVideos?.[0]?.video?.uri;
        if (!videoUri) {
          throw new Error('Veo: Operation completed but no video URI returned');
        }
        return videoUri;
      }
    }

    throw new Error('Veo operation timed out after 10 minutes');
  }
}
