import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import yaml from 'yaml';
import { loadConfig, getConfigValue } from '../../core/config.js';
import { createProvider } from '../../providers/index.js';
import { addHistoryEntry } from '../../core/history.js';
import { generateFilename, ensureOutputDir, downloadVideo, saveVideoFile } from '../../core/output.js';
import { applyPreset, STYLE_PRESETS } from '../../core/presets.js';
import { estimateCost } from '../../core/pricing.js';
import type { VideoGenerationRequest } from '../../types/index.js';

interface BatchItem {
  prompt: string;
  provider?: string;
  model?: string;
  duration?: number;
  resolution?: string;
  aspectRatio?: string;
  preset?: string;
  format?: string;
  output?: string;
  negativePrompt?: string;
}

interface BatchResult {
  index: number;
  prompt: string;
  status: 'ok' | 'failed' | 'dry-run';
  provider: string;
  outputPath?: string;
  cost: number;
  elapsed: number;
  error?: string;
}

export function createBatchCommand(): Command {
  return new Command('batch')
    .argument('<file>', 'YAML or JSON batch file with generation requests')
    .description('Batch process multiple video generations from a config file')
    .option('--dry-run', 'Preview without generating')
    .action(async (file: string, options: { dryRun?: boolean }) => {
      const chalk = (await import('chalk')).default;
      const ora = (await import('ora')).default;

      // Validate file
      const filePath = path.resolve(file);
      if (!fs.existsSync(filePath)) {
        console.error(chalk.red(`\n  ✗ File not found: ${filePath}\n`));
        process.exit(1);
      }

      // Parse file
      const raw = fs.readFileSync(filePath, 'utf-8');
      const ext = path.extname(filePath).toLowerCase();
      let items: BatchItem[];

      try {
        const parsed = ext === '.json' ? JSON.parse(raw) : yaml.parse(raw);
        /* v8 ignore next */
        items = Array.isArray(parsed) ? parsed : parsed.items || parsed.videos || [];
      } catch (err: any) {
        console.error(chalk.red(`\n  ✗ Failed to parse ${file}: ${err.message}\n`));
        process.exit(1);
      }

      if (!items.length) {
        console.error(chalk.red('\n  ✗ No items found in batch file\n'));
        process.exit(1);
      }

      const config = loadConfig();
      const total = items.length;
      let totalCost = 0;

      // Display header
      console.log(chalk.bold(`\n  📦 Batch Processing: ${total} video(s)`));
      if (options.dryRun) {
        console.log(chalk.yellow('  (dry run — no videos will be generated)\n'));
      } else {
        console.log('');
      }

      const results: BatchResult[] = [];

      for (let i = 0; i < total; i++) {
        const item = items[i];
        /* v8 ignore next 4 */
        const providerName = item.provider || config.defaults?.provider || 'runway';
        const duration = item.duration || config.defaults?.duration || 5;
        const format = item.format || config.defaults?.format || 'mp4';
        const modelName = item.model || '';

        let prompt = item.prompt;
        if (item.preset && STYLE_PRESETS[item.preset]) {
          prompt = applyPreset(prompt, item.preset);
        }

        const cost = estimateCost(providerName, modelName, duration);
        totalCost += cost;

        const prefix = chalk.dim(`  [${i + 1}/${total}]`);

        // Dry run
        if (options.dryRun) {
          console.log(`${prefix} ${chalk.bold(providerName)}/${modelName || 'default'} — ${duration}s — ~$${cost.toFixed(4)}`);
          /* v8 ignore next */
          console.log(chalk.dim(`         "${prompt.slice(0, 60)}${prompt.length > 60 ? '...' : ''}"`));
          results.push({
            index: i,
            prompt,
            status: 'dry-run',
            provider: providerName,
            cost,
            elapsed: 0,
          });
          continue;
        }

        // Generate
        const spinner = ora({
          text: `[${i + 1}/${total}] Generating with ${providerName}...`,
          indent: 2,
        }).start();

        try {
          const provider = createProvider(providerName);
          const apiKey = getConfigValue(`${providerName}.apiKey`) as string | undefined;
          /* v8 ignore next 3 */
          if (apiKey) provider.configure(apiKey);
          else if (provider.info.requiresApiKey) {
            throw new Error(`No API key configured for ${providerName}`);
          }

          /* v8 ignore start */
          const request: VideoGenerationRequest = {
            prompt,
            duration,
            model: modelName || undefined,
            resolution: item.resolution,
            aspectRatio: item.aspectRatio,
            format,
            negativePrompt: item.negativePrompt,
          };
          /* v8 ignore stop */

          const result = await provider.generate(request);

          // Save video
          const video = result.videos[0];
          /* v8 ignore next */
          if (!video) throw new Error('No video in response');

          /* v8 ignore next 2 */
          const outputPath = item.output
            ? path.resolve(item.output)
            : generateFilename(providerName, prompt, format);
          ensureOutputDir(outputPath);

          let savedPath: string;
          if (video.url) {
            savedPath = await downloadVideo(video.url, outputPath);
          } else if (video.base64) {
            const buffer = Buffer.from(video.base64, 'base64');
            savedPath = saveVideoFile(buffer, outputPath);
          } else if (video.localPath) {
            savedPath = video.localPath;
          } else {
            throw new Error('No video data in response');
          }

          // History
          /* v8 ignore next 2 */
          if (config.history?.enabled !== false) {
            const modelUsed = result.model || modelName || provider.info.defaultModel;
            addHistoryEntry({
              provider: providerName,
              model: modelUsed,
              prompt,
              duration,
              cost,
              outputPath: savedPath,
            });
          }

          spinner.succeed(`[${i + 1}/${total}] ${providerName} — ${(result.elapsed / 1000).toFixed(1)}s → ${savedPath}`);
          results.push({
            index: i,
            prompt,
            status: 'ok',
            provider: providerName,
            outputPath: savedPath,
            cost,
            elapsed: result.elapsed,
          });
        } catch (err: any) {
          spinner.fail(`[${i + 1}/${total}] ${providerName} — ${err.message}`);
          results.push({
            index: i,
            prompt,
            status: 'failed',
            provider: providerName,
            cost: 0,
            elapsed: 0,
            error: err.message,
          });
        }
      }

      // Summary
      const succeeded = results.filter((r) => r.status === 'ok').length;
      const failed = results.filter((r) => r.status === 'failed').length;

      console.log(chalk.bold(`\n  📊 Summary: ${succeeded}/${total} succeeded`));
      if (failed > 0) {
        console.log(chalk.red(`  ${failed} failed`));
      }
      console.log(chalk.dim(`  Total estimated cost: ~$${totalCost.toFixed(4)}\n`));
    });
}
