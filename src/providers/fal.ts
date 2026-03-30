import { readFileSync } from 'node:fs';
import {
  falSubmitJob,
  falPollStatus,
  falGetResult,
  falExtractMediaUrl,
  type FalOptions,
} from '@magicpro97/forge-core';
import { VideoProvider } from './base.js';
import type { VideoGenerationRequest, VideoGenerationResult, ProviderInfo } from '../types/index.js';

export class FalProvider extends VideoProvider {
  private apiKey: string = '';
  private baseUrl = 'https://queue.fal.run';

  get info(): ProviderInfo {
    return {
      name: 'fal',
      displayName: 'fal.ai (Multi-model)',
      description: 'Multiple video generation models via fal.ai — Kling, Veo, Luma, Sora',
      website: 'https://fal.ai/',
      requiresApiKey: true,
      defaultModel: 'fal-ai/kling-video/v2.5/standard/text-to-video',
      supportedModels: [
        'fal-ai/kling-video/v2.5/standard/text-to-video',
        'fal-ai/veo3',
        'fal-ai/luma-dream-machine/ray-2',
        'fal-ai/sora-2/text-to-video',
      ],
      capabilities: {
        textToVideo: true,
        imageToVideo: true,
        videoEditing: false,
        audioGeneration: false,
        variations: false,
      },
      pricing: {
        currency: 'USD',
        unit: 'generation',
        rates: {
          'fal-ai/kling-video/v2.5/standard/text-to-video': 0.065,
          'fal-ai/veo3': 0.50,
          'fal-ai/luma-dream-machine/ray-2': 0.30,
          'fal-ai/sora-2/text-to-video': 0.40,
        },
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
    return true;
  }

  private getFalOptions(): FalOptions {
    return { apiKey: this.apiKey, baseUrl: this.baseUrl };
  }

  async generate(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
    if (!this.apiKey) {
      throw new Error('fal.ai API key not configured. Run: videoforge config set fal.apiKey <key>');
    }

    const startTime = Date.now();
    const model = request.model || 'fal-ai/kling-video/v2.5/standard/text-to-video';
    const duration = request.duration || 5;

    const body: Record<string, unknown> = {
      prompt: request.prompt,
      duration,
    };

    if (request.aspectRatio) {
      body.aspect_ratio = request.aspectRatio;
    }
    if (request.negativePrompt) {
      body.negative_prompt = request.negativePrompt;
    }
    if (request.seed !== undefined) {
      body.seed = request.seed;
    }

    const requestId = await this.submitJob(model, body);
    await this.pollStatus(model, requestId);
    const videoUrl = await this.getResult(model, requestId);
    const elapsed = Date.now() - startTime;

    return {
      videos: [{ url: videoUrl, duration }],
      provider: 'fal',
      model,
      elapsed,
      metadata: { requestId },
    };
  }

  async animate(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
    if (!this.apiKey) {
      throw new Error('fal.ai API key not configured. Run: videoforge config set fal.apiKey <key>');
    }
    if (!request.inputImage) {
      throw new Error('fal.ai animate requires an input image (--input)');
    }

    const startTime = Date.now();
    const model = request.model || 'fal-ai/kling-video/v2.5/standard/text-to-video';
    const duration = request.duration || 5;

    const imageBuffer = readFileSync(request.inputImage);
    const base64Image = imageBuffer.toString('base64');
    const dataUri = `data:image/png;base64,${base64Image}`;

    const body: Record<string, unknown> = {
      prompt: request.prompt,
      image_url: dataUri,
      duration,
    };

    if (request.aspectRatio) {
      body.aspect_ratio = request.aspectRatio;
    }
    if (request.negativePrompt) {
      body.negative_prompt = request.negativePrompt;
    }
    if (request.seed !== undefined) {
      body.seed = request.seed;
    }

    const requestId = await this.submitJob(model, body);
    await this.pollStatus(model, requestId);
    const videoUrl = await this.getResult(model, requestId);
    const elapsed = Date.now() - startTime;

    return {
      videos: [{ url: videoUrl, duration }],
      provider: 'fal',
      model,
      elapsed,
      metadata: { requestId },
    };
  }

  async listModels(): Promise<string[]> {
    return this.info.supportedModels;
  }

  private async submitJob(model: string, body: Record<string, unknown>): Promise<string> {
    const requestId = await falSubmitJob(this.getFalOptions(), model, body);

    // forge-core returns a JSON string for direct results (no request_id);
    // preserve original error for missing request_id
    try {
      JSON.parse(requestId);
      throw new Error('fal.ai: No request_id in submit response');
    } catch (e) {
      if (e instanceof SyntaxError) {
        return requestId;
      }
      throw e;
    }
  }

  private async pollStatus(model: string, requestId: string): Promise<void> {
    try {
      await falPollStatus(this.getFalOptions(), model, requestId);
    } catch (e) {
      if (e instanceof Error && e.message.includes('timed out')) {
        throw new Error('fal.ai job timed out after 10 minutes');
      }
      throw e;
    }
  }

  private async getResult(model: string, requestId: string): Promise<string> {
    const result = await falGetResult(this.getFalOptions(), model, requestId);
    return falExtractMediaUrl(result, 'video');
  }
}
