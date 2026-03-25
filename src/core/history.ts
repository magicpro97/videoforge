import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getConfigDir } from './config.js';
import type { HistoryEntry } from '../types/index.js';

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
  saveHistory([]);
}

export function getHistoryEntry(id: string): HistoryEntry | undefined {
  const entries = loadHistory();
  return entries.find((entry) => entry.id === id);
}
