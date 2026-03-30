import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createHistoryManager, type BaseHistoryEntry } from '@magicpro97/forge-core';
import { getConfigDir } from './config.js';
import type { HistoryEntry } from '../types/index.js';

interface HistoryEntryInternal extends BaseHistoryEntry {
  provider: string;
  model: string;
  prompt: string;
  duration: number;
  resolution?: string;
  cost?: number;
  outputPath?: string;
}

let _manager: ReturnType<typeof createHistoryManager<HistoryEntryInternal>> | null = null;

function getManager() {
  if (!_manager) {
    _manager = createHistoryManager<HistoryEntryInternal>({
      configDir: getConfigDir(),
      maxEntries: 1000,
    });
  }
  return _manager;
}

export function getHistoryPath(): string {
  return path.join(getConfigDir(), 'history.json');
}

export function loadHistory(): HistoryEntry[] {
  const historyPath = getHistoryPath();
  try {
    const raw = fs.readFileSync(historyPath, 'utf-8');
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[]): void {
  const configDir = getConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  fs.writeFileSync(getHistoryPath(), JSON.stringify(entries, null, 2), 'utf-8');
}

export function addHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): HistoryEntry {
  const entries = loadHistory();
  const newEntry: HistoryEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  entries.unshift(newEntry);
  saveHistory(entries);
  return newEntry;
}

export function clearHistory(): void {
  getManager().clearHistory();
}

export function getHistoryEntry(id: string): HistoryEntry | undefined {
  return getManager().getEntry(id) as HistoryEntry | undefined;
}
