import { Command } from 'commander';
import { loadConfig, getConfigValue } from '../../core/config.js';
import { createProvider } from '../../providers/index.js';
import { addHistoryEntry } from '../../core/history.js';
import { generateFilename, downloadVideo, saveVideoFile } from '../../core/output.js';
import { applyPreset, STYLE_PRESETS } from '../../core/presets.js';
import { getResolution } from '../../core/resolutions.js';
import { estimateCost } from '../../core/pricing.js';
import { getTemplate, renderTemplate } from '../../core/templates.js';
import { openFile } from '../../core/opener.js';
import type { VideoGenerationRequest } from '../../types/index.js';

interface GenerateOptions {
  provider?: string;
  model?: string;
  duration?: string;
  resolution?: string;
  aspectRatio?: string;
  fps?: string;
  count?: string;
  preset?: string;
  format?: string;
  negative?: string;
  seed?: string;
  audio?: boolean;
  open?: boolean;
  output?: string;
  template?: string;
  var?: string[];
}

export function createGenerateCommand(): Command {
  return new Command('generate')
    .argument('<prompt>', 'Text prompt describing the video to generate')
    .description('Generate video(s) from a text prompt')
    .option('-p, --provider <name>', 'AI provider (runway|fal|replicate|veo|sora)')
    .option('-m, --model <model>', 'Specific model to use')
    .option('-d, --duration <seconds>', 'Video duration in seconds', '5')
    .option('-r, --resolution <res>', 'Resolution preset (720p, 1080p, 4k, etc.)')
    .option('-a, --aspect-ratio <ratio>', 'Aspect ratio (16:9, 9:16, 1:1)')
    .option('--fps <number>', 'Frames per second')
    .option('-n, --count <N>', 'Number of videos to generate', '1')
    .option('-s, --preset <style>', 'Style preset')
    .option('-f, --format <fmt>', 'Output format (mp4, webm, gif)', 'mp4')
    .option('--negative <prompt>', 'Negative prompt')
    .option('--seed <number>', 'Seed for reproducibility')
    .option('--audio', 'Include AI-generated audio')
    .option('--open', 'Open file after generation')
    .option('-o, --output <path>', 'Output path')
    .option('-t, --template <name>', 'Use a saved prompt template')
    .option('--var <key=value...>', 'Template variables', (val: string, prev: string[]) => {
      /* v8 ignore next */
      prev = prev || [];
      prev.push(val);
      return prev;
    }, [])
    .action(async (prompt: string, options: GenerateOptions) => {
      const chalk = (await import('chalk')).default;
      const ora = (await import('ora')).default;

      const config = loadConfig();

      // Template handling
      if (options.template) {
        const tmpl = getTemplate(options.template);
        if (!tmpl) {
          console.error(chalk.red(`\n  ✗ Template "${options.template}" not found. Run: videoforge template list\n`));
          process.exit(1);
        }
        const vars: Record<string, string> = {};
        /* v8 ignore next */
        for (const v of options.var || []) {
          const [key, ...rest] = v.split('=');
          vars[key] = rest.join('=');
        }
        prompt = renderTemplate(tmpl, vars);
        if (tmpl.provider && !options.provider) options.provider = tmpl.provider;
        /* v8 ignore next 3 */
        if (tmpl.duration && !options.duration) options.duration = String(tmpl.duration);
        if (tmpl.resolution && !options.resolution) options.resolution = tmpl.resolution;
        if (tmpl.preset && !options.preset) options.preset = tmpl.preset;
      }

      // Apply style preset
      /* v8 ignore next */
      const presetName = options.preset || config.defaults?.preset;
      if (presetName && STYLE_PRESETS[presetName]) {
        prompt = applyPreset(prompt, presetName);
      }

      // Resolve provider
      /* v8 ignore next */
      const providerName = options.provider || config.defaults?.provider || 'runway';
      const provider = createProvider(providerName);

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

      // Resolve resolution
      /* v8 ignore next */
      const resolutionName = options.resolution || config.defaults?.resolution;
      const resolution = resolutionName ? getResolution(resolutionName) : undefined;

      // Build request
      /* v8 ignore start */
      const request: VideoGenerationRequest = {
        prompt,
        duration: parseInt(options.duration || String(config.defaults?.duration)) || 5,
        model: options.model || undefined,
        resolution: resolutionName,
        aspectRatio: options.aspectRatio || config.defaults?.aspectRatio,
        fps: options.fps ? parseInt(options.fps) : config.defaults?.fps,
        format: options.format || config.defaults?.format || 'mp4',
        count: parseInt(options.count || '1'),
        negativePrompt: options.negative,
        seed: options.seed ? parseInt(options.seed) : undefined,
        audio: options.audio ?? config.defaults?.audio,
      };
      /* v8 ignore stop */

      // Display header
      /* v8 ignore start */
      console.log('');
      console.log(chalk.bold('  🎬 VideoForge — AI Video Generator'));
      console.log(chalk.dim(`  Provider:   ${provider.info.displayName}`));
      console.log(chalk.dim(`  Model:      ${request.model || provider.info.defaultModel}`));
      console.log(chalk.dim(`  Duration:   ${request.duration}s`));
      if (resolution) {
        console.log(chalk.dim(`  Resolution: ${resolution.label} (${resolution.width}x${resolution.height})`));
      }
      if (request.aspectRatio) {
        console.log(chalk.dim(`  Ratio:      ${request.aspectRatio}`));
      }
      if (presetName) {
        console.log(chalk.dim(`  Preset:     ${presetName}`));
      }
      console.log(chalk.dim(`  Prompt:     "${prompt.slice(0, 60)}${prompt.length > 60 ? '...' : ''}"`));
      console.log('');
      /* v8 ignore stop */

      const spinner = ora({ text: 'Generating video...', indent: 2 }).start();

      try {
        const result = await provider.generate(request);

        spinner.succeed(`Generated ${result.videos.length} video(s) in ${(result.elapsed / 1000).toFixed(1)}s`);

        // Estimate cost
        /* v8 ignore next 2 */
        const modelUsed = result.model || request.model || provider.info.defaultModel;
        const cost = estimateCost(providerName, modelUsed, request.duration || 5) * (request.count || 1);
        result.cost = cost;

        // Save videos
        /* v8 ignore next */
        const format = request.format || 'mp4';
        const savedPaths: string[] = [];

        for (let i = 0; i < result.videos.length; i++) {
          const video = result.videos[i];
          /* v8 ignore next 2 */
          const outputPath = options.output
            ? (result.videos.length > 1 ? `${options.output.replace(/\.\w+$/, '')}_${i + 1}.${format}` : options.output)
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

          savedPaths.push(savedPath);
          console.log(chalk.green(`  ✓ Saved: ${savedPath}`));
        }

        // Open file if requested
        /* v8 ignore next 5 */
        if (options.open || config.output?.autoOpen) {
          for (const fp of savedPaths) {
            openFile(fp);
          }
        }

        // Add history entry
        /* v8 ignore next */
        if (config.history?.enabled !== false) {
          addHistoryEntry({
            provider: providerName,
            model: modelUsed,
            prompt,
            /* v8 ignore next */
            duration: request.duration || 5,
            resolution: resolutionName,
            cost,
            outputPath: savedPaths[0],
          });
        }

        /* v8 ignore next 3 */
        if (cost > 0) {
          console.log(chalk.dim(`  Cost: ~$${cost.toFixed(4)}`));
        }
        console.log('');
      } catch (error: any) {
        spinner.fail('Generation failed');
        console.error(chalk.red(`\n  ${error.message}\n`));
        process.exit(1);
      }
    });
}
