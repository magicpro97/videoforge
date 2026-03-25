import fs from 'node:fs';
import path from 'node:path';
import { getConfigDir } from './config.js';
import type { TemplateEntry } from '../types/index.js';

export function getTemplatesPath(): string {
  return path.join(getConfigDir(), 'templates.json');
}

export function loadTemplates(): TemplateEntry[] {
  const templatesPath = getTemplatesPath();
  try {
    const raw = fs.readFileSync(templatesPath, 'utf-8');
    return JSON.parse(raw) as TemplateEntry[];
  } catch {
    return [];
  }
}

export function saveTemplates(templates: TemplateEntry[]): void {
  const configDir = getConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  fs.writeFileSync(getTemplatesPath(), JSON.stringify(templates, null, 2), 'utf-8');
}

export function addTemplate(entry: TemplateEntry): void {
  const templates = loadTemplates();
  const existingIndex = templates.findIndex((t) => t.name === entry.name);
  if (existingIndex >= 0) {
    templates[existingIndex] = entry;
  } else {
    templates.push(entry);
  }
  saveTemplates(templates);
}

export function removeTemplate(name: string): boolean {
  const templates = loadTemplates();
  const filtered = templates.filter((t) => t.name !== name);
  if (filtered.length === templates.length) {
    return false;
  }
  saveTemplates(filtered);
  return true;
}

export function getTemplate(name: string): TemplateEntry | undefined {
  const templates = loadTemplates();
  return templates.find((t) => t.name === name);
}

export function renderTemplate(template: TemplateEntry, variables: Record<string, string>): string {
  let result = template.prompt;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}
