import { createConfigManager } from '@magicpro97/forge-core';
import type { AppConfig } from '../types/index.js';

let _manager: ReturnType<typeof createConfigManager<AppConfig>> | null = null;

function getManager() {
  if (!_manager) {
    _manager = createConfigManager<AppConfig>({
      toolName: 'videoforge',
      defaultConfig: {} as AppConfig,
    });
  }
  return _manager;
}

export function getConfigDir(): string {
  return getManager().getConfigDir();
}

export function getConfigPath(): string {
  return getManager().getConfigFilePath();
}

export function loadConfig(): AppConfig {
  return getManager().loadConfig();
}

export function saveConfig(config: AppConfig): void {
  getManager().saveConfig(config);
}

export function getConfigValue(key: string): unknown {
  return getManager().getConfigValue(key);
}

export function setConfigValue(key: string, value: string): void {
  const config = loadConfig();
  const parts = key.split('.');
  let current: Record<string, unknown> = config as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || typeof current[part] !== 'object' || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = parseValue(value);
  saveConfig(config);
}

export function parseValue(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  const num = Number(value);
  if (!isNaN(num) && value.trim() !== '') return num;
  return value;
}
