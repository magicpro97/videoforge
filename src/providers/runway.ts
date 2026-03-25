import { readFileSync } from 'node:fs';
import { VideoProvider } from './base.js';
import type { VideoGenerationRequest, VideoGenerationResult, ProviderInfo } from '../types/index.js';

const ASPECT_RATIO_MAP: Record<string, string> = {
  '16:9': '1280:720',
  '9:16': '720:1280',
  '1:1': '1024:1024',
  '4:3': '1024:768',
  '3:4': '768:1024',
};

export class RunwayProvider extends VideoProvider {
  private apiKey: string = '';
  private baseUrl = 'https://api.dev.runwayml.com/v1';

  get info(): ProviderInfo {
    return {
      name: 'runway',
      displayName: 'Runway (Gen-4)',
      description: 'Runway Gen-4 text-to-video and image-to-video generation',
      website: 'https://runwayml.com/',
      requiresApiKey: true,
      defaultModel: 'gen4_turbo',
      supportedModels: ['gen4_turbo', 'gen4', 'gen4.5'],
      capabilities: {
        textToVideo: true,
        imageToVideo: true,
        videoEditing: false,
        audioGeneration: false,
        variations: false,
      },
      pricing: {
        currency: 'USD',
        unit: 'second',
        rates: { gen4_turbo: 0.05, gen4: 0.05, 'gen4.5': 0.10 },
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

  async generate(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
    if (!this.apiKey) {
      throw new Error('Runway API key not configured. Run: videoforge config set runway.apiKey <key>');
    }

    const startTime = Date.now();
    const model = request.model || 'gen4_turbo';
    const duration = request.duration || 5;
    /* v8 ignore next */
    const ratio = ASPECT_RATIO_MAP[request.aspectRatio || '16:9'] || '1280:720';

    const body: Record<string, unknown> = {
      model,
      promptText: request.prompt,
      duration,
      ratio,
    };

    const response = await fetch(`${this.baseUrl}/image_to_video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'X-Runway-Version': '2024-11-06',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg = (errorData as Record<string, string>)?.error || response.statusText;
      throw new Error(`Runway API error (${response.status}): ${msg}`);
    }

    const taskData: { id: string } = await response.json() as { id: string };
    const videoUrl = await this.pollTask(taskData.id);
    const elapsed = Date.now() - startTime;

    return {
      videos: [{ url: videoUrl, duration }],
      provider: 'runway',
      model,
      elapsed,
      metadata: { taskId: taskData.id },
    };
  }

  async animate(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
    if (!this.apiKey) {
      throw new Error('Runway API key not configured. Run: videoforge config set runway.apiKey <key>');
    }
    if (!request.inputImage) {
      throw new Error('Runway animate requires an input image (--input)');
    }

    const startTime = Date.now();
    const model = request.model || 'gen4_turbo';
    const duration = request.duration || 5;
    /* v8 ignore next */
    const ratio = ASPECT_RATIO_MAP[request.aspectRatio || '16:9'] || '1280:720';

    const imageBuffer = readFileSync(request.inputImage);
    const base64Image = imageBuffer.toString('base64');
    const dataUri = `data:image/png;base64,${base64Image}`;

    const body: Record<string, unknown> = {
      model,
      promptText: request.prompt,
      promptImage: dataUri,
      duration,
      ratio,
    };

    const response = await fetch(`${this.baseUrl}/image_to_video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'X-Runway-Version': '2024-11-06',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg = (errorData as Record<string, string>)?.error || response.statusText;
      throw new Error(`Runway API error (${response.status}): ${msg}`);
    }

    const taskData: { id: string } = await response.json() as { id: string };
    const videoUrl = await this.pollTask(taskData.id);
    const elapsed = Date.now() - startTime;

    return {
      videos: [{ url: videoUrl, duration }],
      provider: 'runway',
      model,
      elapsed,
      metadata: { taskId: taskData.id },
    };
  }

  async listModels(): Promise<string[]> {
    return this.info.supportedModels;
  }

  private async pollTask(taskId: string): Promise<string> {
    const pollInterval = 3000;
    const maxIterations = 100;

    for (let i = 0; i < maxIterations; i++) {
      await new Promise(r => setTimeout(r, pollInterval));

      const pollResponse = await fetch(`${this.baseUrl}/tasks/${taskId}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'X-Runway-Version': '2024-11-06',
        },
      });

      if (!pollResponse.ok) {
        const errorData = await pollResponse.json().catch(() => ({}));
        const msg = (errorData as Record<string, string>)?.error || pollResponse.statusText;
        throw new Error(`Runway poll error (${pollResponse.status}): ${msg}`);
      }

      const taskResult = await pollResponse.json() as {
        status: string;
        output?: string[];
        failure?: string;
      };

      if (taskResult.status === 'SUCCEEDED') {
        const url = taskResult.output?.[0];
        if (!url) {
          throw new Error('Runway: Task succeeded but no output URL returned');
        }
        return url;
      }

      if (taskResult.status === 'FAILED') {
        throw new Error(`Runway task failed: ${taskResult.failure || 'Unknown error'}`);
      }
    }

    throw new Error('Runway task timed out after 5 minutes');
  }
}
