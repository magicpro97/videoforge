import fs from 'node:fs';
import path from 'node:path';
import { saveOutputFiles } from '@magicpro97/forge-core';

export { saveOutputFiles };

export function generateFilename(provider: string, prompt: string, format: string): string {
  const sanitized = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join('-');
  const timestamp = Date.now();
  return `videoforge-${provider}-${sanitized}-${timestamp}.${format}`;
}

export function ensureOutputDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function saveVideoFile(data: Buffer, outputPath: string): string {
  const dir = path.dirname(outputPath);
  ensureOutputDir(dir);
  fs.writeFileSync(outputPath, data);
  return outputPath;
}

export async function downloadVideo(url: string, outputPath: string): Promise<string> {
  const dir = path.dirname(outputPath);
  ensureOutputDir(dir);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}
