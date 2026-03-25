import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

interface ConvertOptions {
  to?: string;
  fps?: string;
  resize?: string;
  output?: string;
}

function isFfmpegAvailable(): boolean {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function createConvertCommand(): Command {
  return new Command('convert')
    .argument('<input>', 'Input video file path')
    .description('Convert video format using ffmpeg')
    .option('--to <format>', 'Target format (mp4, webm, gif)', 'mp4')
    .option('--fps <number>', 'Target frames per second')
    .option('--resize <resolution>', 'Target resolution (e.g., 1080p, 720p, 1920x1080)')
    .option('-o, --output <path>', 'Output file path')
    .action(async (input: string, options: ConvertOptions) => {
      const chalk = (await import('chalk')).default;
      const ora = (await import('ora')).default;

      // Validate input
      const inputPath = path.resolve(input);
      if (!fs.existsSync(inputPath)) {
        console.error(chalk.red(`\n  ✗ File not found: ${inputPath}\n`));
        process.exit(1);
      }

      // Check ffmpeg
      if (!isFfmpegAvailable()) {
        console.error(chalk.red('\n  ✗ ffmpeg is not installed or not in PATH.'));
        console.error(chalk.yellow('  → Install ffmpeg: https://ffmpeg.org/download.html'));
        console.error(chalk.dim('    macOS:  brew install ffmpeg'));
        console.error(chalk.dim('    Ubuntu: sudo apt install ffmpeg'));
        console.error(chalk.dim('    Windows: winget install ffmpeg\n'));
        process.exit(1);
      }

      /* v8 ignore next */
      const targetFormat = options.to || 'mp4';
      const inputExt = path.extname(inputPath).slice(1).toLowerCase();

      // Determine output path
      const baseName = path.basename(inputPath, path.extname(inputPath));
      const outputDir = path.dirname(inputPath);
      const outputPath = options.output || path.join(outputDir, `${baseName}_converted.${targetFormat}`);

      // Build ffmpeg command
      const args: string[] = ['-i', `"${inputPath}"`, '-y'];

      // FPS
      if (options.fps) {
        args.push('-r', options.fps);
      }

      // Resize
      if (options.resize) {
        let scale: string;
        const resolutionMap: Record<string, string> = {
          '480p': '854:480',
          '720p': '1280:720',
          '1080p': '1920:1080',
          '4k': '3840:2160',
          '2160p': '3840:2160',
        };

        if (resolutionMap[options.resize]) {
          scale = resolutionMap[options.resize];
        } else if (options.resize.includes('x')) {
          scale = options.resize.replace('x', ':');
        } else {
          console.error(chalk.red(`\n  ✗ Invalid resolution: ${options.resize}`));
          console.error(chalk.dim('  Use: 480p, 720p, 1080p, 4k, or WIDTHxHEIGHT\n'));
          process.exit(1);
        }

        args.push('-vf', `scale=${scale}`);
      }

      // Format-specific options
      /* v8 ignore start */
      if (targetFormat === 'gif') {
        if (!options.fps) args.push('-r', '15');
        args.push('-vf', args.some((a) => a.startsWith('scale='))
          ? args.splice(args.indexOf('-vf') + 1, 1, `${args[args.indexOf('-vf') + 1]},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`)[0] || ''
          : 'split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse');
      } else if (targetFormat === 'webm') {
        args.push('-c:v', 'libvpx-vp9', '-b:v', '2M');
      } else if (targetFormat === 'mp4') {
        args.push('-c:v', 'libx264', '-crf', '23', '-preset', 'medium');
      }
      /* v8 ignore stop */

      args.push(`"${outputPath}"`);

      // Display header
      console.log('');
      console.log(chalk.bold('  🔄 VideoForge — Format Convert'));
      console.log(chalk.dim(`  Input:   ${path.basename(inputPath)} (${inputExt})`));
      console.log(chalk.dim(`  Output:  ${path.basename(outputPath)} (${targetFormat})`));
      if (options.fps) console.log(chalk.dim(`  FPS:     ${options.fps}`));
      if (options.resize) console.log(chalk.dim(`  Resize:  ${options.resize}`));
      console.log('');

      const spinner = ora({ text: 'Converting video...', indent: 2 }).start();

      try {
        const cmd = `ffmpeg ${args.join(' ')}`;
        execSync(cmd, { stdio: 'pipe' });

        // Get file size
        const stats = fs.statSync(outputPath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

        spinner.succeed(`Converted successfully (${sizeMB} MB)`);
        console.log(chalk.green(`  ✓ Saved: ${outputPath}`));
        console.log('');
      } catch (error: any) {
        spinner.fail('Conversion failed');
        /* v8 ignore next */
        const stderr = error.stderr?.toString() || error.message;
        console.error(chalk.red(`\n  ${stderr.split('\n').slice(-3).join('\n  ')}\n`));
        process.exit(1);
      }
    });
}
