export interface VideoGenerationRequest {
  prompt: string;
  duration?: number;
  model?: string;
  resolution?: string;
  aspectRatio?: string;
  fps?: number;
  format?: string;
  quality?: number;
  count?: number;
  preset?: string;
  seed?: number;
  negativePrompt?: string;
  inputImage?: string;
  audio?: boolean;
  output?: string;
}

export interface GeneratedVideo {
  url?: string;
  base64?: string;
  localPath?: string;
  duration?: number;
  width?: number;
  height?: number;
  format?: string;
}

export interface VideoGenerationResult {
  videos: GeneratedVideo[];
  provider: string;
  model: string;
  elapsed: number;
  cost?: number;
  metadata: Record<string, unknown>;
}

export interface ProviderInfo {
  name: string;
  displayName: string;
  description: string;
  website: string;
  requiresApiKey: boolean;
  defaultModel: string;
  supportedModels: string[];
  capabilities: ProviderCapabilities;
  pricing: ProviderPricing;
}

export interface ProviderCapabilities {
  textToVideo: boolean;
  imageToVideo: boolean;
  videoEditing: boolean;
  audioGeneration: boolean;
  variations: boolean;
}

export interface ProviderPricing {
  currency: string;
  unit: string;
  rates: Record<string, number>;
}
