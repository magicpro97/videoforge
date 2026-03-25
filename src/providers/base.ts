import type { VideoGenerationRequest, VideoGenerationResult, ProviderInfo } from '../types/index.js';

export abstract class VideoProvider {
  abstract get info(): ProviderInfo;
  abstract configure(apiKey: string): void;
  abstract isConfigured(): boolean;
  abstract validate(): Promise<boolean>;
  abstract generate(request: VideoGenerationRequest): Promise<VideoGenerationResult>;
  abstract listModels(): Promise<string[]>;

  async animate(_request: VideoGenerationRequest): Promise<VideoGenerationResult> {
    throw new Error(`${this.info.name} does not support image-to-video`);
  }

  async vary(_request: VideoGenerationRequest): Promise<VideoGenerationResult> {
    throw new Error(`${this.info.name} does not support video variations`);
  }
}
