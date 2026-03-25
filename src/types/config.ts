export interface ProviderConfig {
  apiKey?: string;
  model?: string;
  [key: string]: unknown;
}

export interface DefaultsConfig {
  provider?: string;
  duration?: number;
  resolution?: string;
  aspectRatio?: string;
  fps?: number;
  format?: string;
  preset?: string;
  audio?: boolean;
}

export interface OutputConfig {
  directory?: string;
  filenamePattern?: string;
  autoOpen?: boolean;
}

export interface HistoryConfig {
  enabled?: boolean;
  maxEntries?: number;
}

export interface AppConfig {
  runway?: ProviderConfig;
  fal?: ProviderConfig;
  replicate?: ProviderConfig;
  veo?: ProviderConfig;
  sora?: ProviderConfig;
  defaults?: DefaultsConfig;
  output?: OutputConfig;
  history?: HistoryConfig;
  [key: string]: unknown;
}

export interface HistoryEntry {
  id: string;
  timestamp: string;
  provider: string;
  model: string;
  prompt: string;
  duration: number;
  resolution?: string;
  cost?: number;
  outputPath?: string;
}

export interface TemplateEntry {
  name: string;
  prompt: string;
  provider?: string;
  duration?: number;
  resolution?: string;
  preset?: string;
}
