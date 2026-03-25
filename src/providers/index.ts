import { VideoProvider } from './base.js';
import { RunwayProvider } from './runway.js';
import { FalProvider } from './fal.js';
import { ReplicateProvider } from './replicate.js';
import { VeoProvider } from './veo.js';
import { SoraProvider } from './sora.js';

export { VideoProvider } from './base.js';
export { RunwayProvider } from './runway.js';
export { FalProvider } from './fal.js';
export { ReplicateProvider } from './replicate.js';
export { VeoProvider } from './veo.js';
export { SoraProvider } from './sora.js';

const providerRegistry = new Map<string, () => VideoProvider>([
  ['runway', () => new RunwayProvider()],
  ['fal', () => new FalProvider()],
  ['replicate', () => new ReplicateProvider()],
  ['veo', () => new VeoProvider()],
  ['sora', () => new SoraProvider()],
]);

export function createProvider(name: string): VideoProvider {
  const factory = providerRegistry.get(name.toLowerCase());
  if (!factory) {
    const available = Array.from(providerRegistry.keys()).join(', ');
    throw new Error(`Unknown provider "${name}". Available: ${available}`);
  }
  return factory();
}

export function getAllProviderNames(): string[] {
  return Array.from(providerRegistry.keys());
}

export function createAllProviders(): Map<string, VideoProvider> {
  const providers = new Map<string, VideoProvider>();
  for (const [name, factory] of providerRegistry) {
    providers.set(name, factory());
  }
  return providers;
}
