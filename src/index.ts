#!/usr/bin/env node

import { Command } from 'commander';
import { createGenerateCommand } from './cli/commands/generate.js';
import { createAnimateCommand } from './cli/commands/animate.js';
import { createConfigCommand } from './cli/commands/config.js';
import { createProvidersCommand } from './cli/commands/providers.js';
import { createHistoryCommand } from './cli/commands/history.js';
import { createTemplateCommand } from './cli/commands/template.js';
import { createBatchCommand } from './cli/commands/batch.js';
import { createCompareCommand } from './cli/commands/compare.js';
import { createCostCommand } from './cli/commands/cost.js';
import { createConvertCommand } from './cli/commands/convert.js';

const program = new Command();

program
  .name('videoforge')
  .description('🎬 AI Video Generator CLI — Multi-provider text-to-video and image-to-video generation')
  .version('1.0.0');

// Main generate command with aliases
const generateCmd = createGenerateCommand();
generateCmd.alias('gen').alias('g');
program.addCommand(generateCmd);

// Image-to-video
program.addCommand(createAnimateCommand());

// Config management
program.addCommand(createConfigCommand());

// Provider listing
program.addCommand(createProvidersCommand());

// History management
program.addCommand(createHistoryCommand());

// Template management
program.addCommand(createTemplateCommand());

// Batch processing
program.addCommand(createBatchCommand());

// Cross-provider comparison
program.addCommand(createCompareCommand());

// Cost tracking
program.addCommand(createCostCommand());

// Format conversion
program.addCommand(createConvertCommand());

// Show help if no args
if (!process.argv.slice(2).length) {
  program.outputHelp();
  console.log('');
  console.log('  Quick start:');
  console.log('    $ videoforge generate "a cinematic sunset over the ocean"');
  console.log('    $ videoforge animate photo.png "slow zoom and pan"');
  console.log('    $ videoforge config set runway.apiKey <your-key>');
  console.log('');
} else {
  program.parse();
}
