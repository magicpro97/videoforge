import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig, getConfigValue } from '../../core/config.js';
import { createProvider } from '../../providers/index.js';
import { addHistoryEntry } from '../../core/history.js';
import { generateFilename, downloadVideo, saveVideoFile } from '../../core/output.js';
import { estimateCost } from '../../core/pricing.js';
import { openFile } from '../../core/opener.js';
import type { VideoGenerationRequest } from '../../types/index.js';

interface AnimateOptions {
  provider?: string;
  model?: string;
  duration?: string;
  aspectRatio?: string;
  format?: string;
  open?: boolean;
  output?: string;
}

export function createAnimateCommand(): Command {
  return new Command('animate')
    .argument('<image>', 'Path to the source image file')
    .argument('[prompt]', 'Optional motion/style prompt')
    .description('Generate video from an image (image-to-video)')
    .option('-p, --provider <name>', 'AI provider (runway|fal)')
    .option('-m, --model <model>', 'Specific model to use')
    .option('-d, --duration <seconds>', 'Video duration in seconds', '5')
    .option('-a, --aspect-ratio <ratio>', 'Aspect ratio (16:9, 9:16, 1:1)')
    .option('-f, --format <fmt>', 'Output format (mp4, webm, gif)', 'mp4')
    .option('--open', 'Open file after generation')
    .option('-o, --output <path>', 'Output path')
    .action(async (image: string, prompt: string | undefined, options: AnimateOptions) => {
      const chalk = (await import('chalk')).default;
      const ora = (await import('ora')).default;

      // Validate input image
      const imagePath = path.resolve(image);
      if (!fs.existsSync(imagePath)) {
        console.error(chalk.red(`\n  ✗ Image not found: ${imagePath}\n`));
        process.exit(1);
      }

      const config = loadConfig();

      // Resolve provider
      /* v8 ignore next */
      const providerName = options.provider || config.defaults?.provider || 'runway';
      const provider = createProvider(providerName);

      // Check image-to-video capability
      if (!provider.info.capabilities.imageToVideo) {
        console.error(chalk.red(`\n  ✗ Provider "${providerName}" does not support image-to-video.`));
        console.error(chalk.yellow(`  → Try: videoforge animate ${image} -p runway\n`));
        process.exit(1);
      }

      // Configure API key
      const apiKey = getConfigValue(`${providerName}.apiKey`) as string | undefined;
      if (apiKey) {
        provider.configure(apiKey);
      }

      if (!provider.isConfigured() && provider.info.requiresApiKey) {
        console.error(chalk.red(`\n  ✗ No API key configured for "${providerName}".`));
        console.error(chalk.yellow(`  → Run: videoforge config set ${providerName}.apiKey <your-key>`));
        console.error(chalk.dim(`  → Get key at: ${provider.info.website}\n`));
        process.exit(1);
      }

      /* v8 ignore next 2 */
      const duration = parseInt(options.duration || String(config.defaults?.duration)) || 5;
      const format = options.format || config.defaults?.format || 'mp4';

      /* v8 ignore start */
      const request: VideoGenerationRequest = {
        prompt: prompt || 'Animate this image with natural motion',
        duration,
        model: options.model || undefined,
        aspectRatio: options.aspectRatio || config.defaults?.aspectRatio,
        format,
        inputImage: imagePath,
      };
      /* v8 ignore stop */

      // Display header
      /* v8 ignore start */
      console.log('');
      console.log(chalk.bold('  🎬 VideoForge — Image to Video'));
      console.log(chalk.dim(`  Provider: ${provider.info.displayName}`));
      console.log(chalk.dim(`  Model:    ${request.model || provider.info.defaultModel}`));
      console.log(chalk.dim(`  Image:    ${path.basename(imagePath)}`));
      console.log(chalk.dim(`  Duration: ${duration}s`));
      if (request.prompt) {
        console.log(chalk.dim(`  Prompt:   "${request.prompt.slice(0, 60)}${request.prompt.length > 60 ? '...' : ''}"`));
      }
      console.log('');
      /* v8 ignore stop */

      const spinner = ora({ text: 'Animating image...', indent: 2 }).start();

      try {
        const result = await provider.animate(request);

        spinner.succeed(`Animated in ${(result.elapsed / 1000).toFixed(1)}s`);

        // Estimate cost
        /* v8 ignore next */
        const modelUsed = result.model || request.model || provider.info.defaultModel;
        const cost = estimateCost(providerName, modelUsed, duration);
        result.cost = cost;

        // Save video
        const video = result.videos[0];
        /* v8 ignore next */
        if (!video) throw new Error('No video in response');

        /* v8 ignore next */
        const outputPath = options.output || generateFilename(providerName, request.prompt, format);
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

        console.log(chalk.green(`  ✓ Saved: ${savedPath}`));

        // Open if requested
        /* v8 ignore next 3 */
        if (options.open || config.output?.autoOpen) {
          openFile(savedPath);
        }

        // Add history entry
        /* v8 ignore next */
        if (config.history?.enabled !== false) {
          addHistoryEntry({
            provider: providerName,
            model: modelUsed,
            prompt: request.prompt,
            duration,
            cost,
            outputPath: savedPath,
          });
        }

        /* v8 ignore next 3 */
        if (cost > 0) {
          console.log(chalk.dim(`  Cost: ~$${cost.toFixed(4)}`));
        }
        console.log('');
      } catch (error: any) {
        spinner.fail('Animation failed');
        console.error(chalk.red(`\n  ${error.message}\n`));
        process.exit(1);
      }
    });
}
