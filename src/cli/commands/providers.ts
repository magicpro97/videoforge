import { Command } from 'commander';
import { loadConfig, getConfigValue } from '../../core/config.js';
import { getAllProviderNames, createProvider } from '../../providers/index.js';

export function createProvidersCommand(): Command {
  const cmd = new Command('providers')
    .description('List available AI video providers');

  cmd
    .command('list')
    .description('Show all providers with status')
    .action(async () => {
      const chalk = (await import('chalk')).default;

      const names = getAllProviderNames();

      console.log(chalk.bold('\n  🎬 VideoForge — Available Providers\n'));

      // Table header
      const header = [
        'Provider'.padEnd(12),
        'Display Name'.padEnd(20),
        'Default Model'.padEnd(30),
        'API Key'.padEnd(10),
        'Status',
      ].join('  ');
      console.log(chalk.dim(`  ${header}`));
      console.log(chalk.dim(`  ${'─'.repeat(header.length)}`));

      for (const name of names) {
        const provider = createProvider(name);
        const info = provider.info;

        /* v8 ignore start */
        const apiKey = getConfigValue(`${name}.apiKey`) as string | undefined;
        const hasKey = apiKey && apiKey.length > 0;
        const requiresKey = info.requiresApiKey ? 'required' : 'free';
        const status = hasKey
          ? chalk.green('✓ configured')
          : (info.requiresApiKey ? chalk.red('✗ missing key') : chalk.green('✓ ready'));

        const row = [
          chalk.bold(name.padEnd(12)),
          info.displayName.padEnd(20),
          (info.defaultModel || '-').padEnd(30),
          requiresKey.padEnd(10),
          status,
        ].join('  ');
        /* v8 ignore stop */

        console.log(`  ${row}`);
      }

      console.log(chalk.dim(`\n  Configure a provider:`));
      console.log(chalk.dim(`    videoforge config set <provider>.apiKey <your-key>\n`));
    });

  return cmd;
}
