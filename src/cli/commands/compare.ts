import { Command } from 'commander';
import { loadConfig, getConfigValue } from '../../core/config.js';
import { createProvider, getAllProviderNames } from '../../providers/index.js';
import { generateFilename, downloadVideo, saveVideoFile } from '../../core/output.js';
import { addHistoryEntry } from '../../core/history.js';
import { estimateCost } from '../../core/pricing.js';
import type { VideoGenerationRequest } from '../../types/index.js';

interface CompareOptions {
  duration?: string;
  providers?: string;
  format?: string;
  output?: string;
}

export function createCompareCommand(): Command {
  return new Command('compare')
    .argument('<prompt>', 'Text prompt to compare across providers')
    .description('Compare video generation across multiple providers')
    .option('-d, --duration <seconds>', 'Video duration in seconds', '5')
    .option('--providers <list>', 'Comma-separated list of providers')
    .option('-f, --format <fmt>', 'Output format', 'mp4')
    .option('-o, --output <dir>', 'Output directory')
    .action(async (prompt: string, options: CompareOptions) => {
      const chalk = (await import('chalk')).default;
      const ora = (await import('ora')).default;

      const config = loadConfig();
      /* v8 ignore next 2 */
      const duration = parseInt(options.duration || '5');
      const format = options.format || 'mp4';

      // Resolve providers to compare
      let providerNames: string[];
      if (options.providers) {
        providerNames = options.providers.split(',').map((p) => p.trim());
      } else {
        // Use all configured providers
        providerNames = getAllProviderNames().filter((name) => {
          const apiKey = getConfigValue(`${name}.apiKey`) as string | undefined;
          const provider = createProvider(name);
          return (apiKey && apiKey.length > 0) || !provider.info.requiresApiKey;
        });
      }

      if (providerNames.length === 0) {
        console.error(chalk.red('\n  ✗ No configured providers found.'));
        console.error(chalk.yellow('  → Configure at least one: videoforge config set <provider>.apiKey <key>\n'));
        process.exit(1);
      }

      if (providerNames.length < 2) {
        console.error(chalk.red('\n  ✗ Need at least 2 providers for comparison.'));
        console.error(chalk.yellow(`  → Currently configured: ${providerNames.join(', ')}\n`));
        process.exit(1);
      }

      /* v8 ignore start */
      console.log('');
      console.log(chalk.bold('  🎬 VideoForge — Provider Comparison'));
      console.log(chalk.dim(`  Providers:  ${providerNames.join(', ')}`));
      console.log(chalk.dim(`  Duration:   ${duration}s`));
      console.log(chalk.dim(`  Prompt:     "${prompt.slice(0, 60)}${prompt.length > 60 ? '...' : ''}"`));
      console.log('');
      /* v8 ignore stop */

      const results: Array<{
        provider: string;
        model: string;
        status: 'ok' | 'failed';
        elapsed: number;
        cost: number;
        outputPath?: string;
        error?: string;
      }> = [];

      for (const providerName of providerNames) {
        const spinner = ora({
          text: `Generating with ${providerName}...`,
          indent: 2,
        }).start();

        try {
          const provider = createProvider(providerName);
          const apiKey = getConfigValue(`${providerName}.apiKey`) as string | undefined;
          /* v8 ignore next 4 */
          if (apiKey) provider.configure(apiKey);
          else if (provider.info.requiresApiKey) {
            throw new Error(`No API key for ${providerName}`);
          }

          const request: VideoGenerationRequest = {
            prompt,
            duration,
            format,
          };

          const result = await provider.generate(request);
          /* v8 ignore next */
          const modelUsed = result.model || provider.info.defaultModel;
          const cost = estimateCost(providerName, modelUsed, duration);

          // Save video
          const video = result.videos[0];
          /* v8 ignore next */
          if (!video) throw new Error('No video in response');

          /* v8 ignore next 2 */
          const outputPath = options.output
            ? `${options.output}/${providerName}_${Date.now()}.${format}`
            : generateFilename(providerName, prompt, format);
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
          /* v8 ignore next */
          if (config.history?.enabled !== false) {
            addHistoryEntry({
              provider: providerName,
              model: modelUsed,
              prompt,
              duration,
              cost,
              outputPath: savedPath,
            });
          }

          spinner.succeed(`${providerName} — ${(result.elapsed / 1000).toFixed(1)}s — $${cost.toFixed(4)}`);

          results.push({
            provider: providerName,
            model: modelUsed,
            status: 'ok',
            elapsed: result.elapsed,
            cost,
            outputPath: savedPath,
          });
        } catch (err: any) {
          spinner.fail(`${providerName} — ${err.message}`);
          results.push({
            provider: providerName,
            model: '-',
            status: 'failed',
            elapsed: 0,
            cost: 0,
            error: err.message,
          });
        }
      }

      // Comparison table
      console.log(chalk.bold('\n  📊 Comparison Results\n'));

      const header = [
        'Provider'.padEnd(12),
        'Model'.padEnd(25),
        'Time'.padEnd(10),
        'Cost'.padEnd(10),
        'Output',
      ].join('  ');
      console.log(chalk.dim(`  ${header}`));
      console.log(chalk.dim(`  ${'─'.repeat(header.length)}`));

      for (const r of results) {
        /* v8 ignore start */
        const timeStr = r.status === 'ok' ? `${(r.elapsed / 1000).toFixed(1)}s` : '-';
        const costStr = r.status === 'ok' ? `$${r.cost.toFixed(4)}` : '-';
        const outputStr = r.status === 'ok'
          ? chalk.green(r.outputPath || '-')
          : chalk.red(r.error || 'failed');
        /* v8 ignore stop */

        const row = [
          chalk.bold(r.provider.padEnd(12)),
          r.model.padEnd(25),
          timeStr.padEnd(10),
          costStr.padEnd(10),
          outputStr,
        ].join('  ');

        console.log(`  ${row}`);
      }

      const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
      const succeeded = results.filter((r) => r.status === 'ok').length;

      console.log(chalk.dim(`\n  ${succeeded}/${providerNames.length} providers succeeded`));
      console.log(chalk.dim(`  Total cost: ~$${totalCost.toFixed(4)}\n`));
    });
}
