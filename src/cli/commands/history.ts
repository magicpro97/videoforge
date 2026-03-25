import { Command } from 'commander';
import { loadHistory, getHistoryEntry, clearHistory } from '../../core/history.js';

export function createHistoryCommand(): Command {
  const cmd = new Command('history')
    .description('View and manage generation history');

  cmd
    .command('list')
    .alias('ls')
    .description('List recent generations')
    .option('-l, --limit <N>', 'Number of entries to show', '10')
    .action(async (options: { limit: string }) => {
      const chalk = (await import('chalk')).default;

      const entries = loadHistory();
      /* v8 ignore next */
      const limit = parseInt(options.limit) || 10;
      const recent = entries.slice(-limit).reverse();

      if (recent.length === 0) {
        console.log(chalk.dim('\n  No history entries yet.\n'));
        return;
      }

      console.log(chalk.bold(`\n  📜 Recent Generations (last ${recent.length})\n`));

      // Table header
      const header = [
        'ID'.padEnd(10),
        'Date'.padEnd(20),
        'Provider'.padEnd(12),
        'Duration'.padEnd(10),
        'Cost'.padEnd(10),
        'Prompt',
      ].join('  ');
      console.log(chalk.dim(`  ${header}`));
      console.log(chalk.dim(`  ${'─'.repeat(90)}`));

      for (const entry of recent) {
        const date = new Date(entry.timestamp).toLocaleString();
        /* v8 ignore next 3 */
        const promptShort = entry.prompt.length > 40
          ? entry.prompt.slice(0, 40) + '...'
          : entry.prompt;
        /* v8 ignore next */
        const cost = entry.cost ? `$${entry.cost.toFixed(4)}` : '-';

        const row = [
          chalk.dim(entry.id.slice(0, 8).padEnd(10)),
          date.padEnd(20),
          chalk.bold(entry.provider.padEnd(12)),
          `${entry.duration}s`.padEnd(10),
          cost.padEnd(10),
          `"${promptShort}"`,
        ].join('  ');

        console.log(`  ${row}`);
      }

      console.log('');
    });

  cmd
    .command('show <id>')
    .description('Show full details of a history entry')
    .action(async (id: string) => {
      const chalk = (await import('chalk')).default;

      const entries = loadHistory();
      const entry = entries.find(
        (e) => e.id === id || e.id.startsWith(id),
      );

      if (!entry) {
        console.error(chalk.red(`\n  ✗ Entry "${id}" not found\n`));
        process.exit(1);
      }

      console.log(chalk.bold('\n  📋 Generation Details\n'));
      console.log(`  ID:         ${entry.id}`);
      console.log(`  Date:       ${new Date(entry.timestamp).toLocaleString()}`);
      console.log(`  Provider:   ${entry.provider}`);
      console.log(`  Model:      ${entry.model}`);
      console.log(`  Duration:   ${entry.duration}s`);
      /* v8 ignore start */
      if (entry.resolution) {
        console.log(`  Resolution: ${entry.resolution}`);
      }
      console.log(`  Prompt:     "${entry.prompt}"`);
      if (entry.cost) {
        console.log(`  Cost:       $${entry.cost.toFixed(4)}`);
      }
      if (entry.outputPath) {
        console.log(chalk.green(`  Output:     ${entry.outputPath}`));
      }
      /* v8 ignore stop */
      console.log('');
    });

  cmd
    .command('clear')
    .description('Clear all generation history')
    .action(async () => {
      const chalk = (await import('chalk')).default;

      const entries = loadHistory();
      if (entries.length === 0) {
        console.log(chalk.dim('\n  History is already empty.\n'));
        return;
      }

      const { default: inquirer } = await import('inquirer');
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Delete ${entries.length} history entries?`,
          default: false,
        },
      ]);

      if (!confirm) {
        console.log(chalk.dim('\n  Cancelled.\n'));
        return;
      }

      clearHistory();
      console.log(chalk.green(`\n  ✓ Cleared ${entries.length} history entries.\n`));
    });

  return cmd;
}
