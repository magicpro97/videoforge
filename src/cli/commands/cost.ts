import { Command } from 'commander';
import { loadHistory } from '../../core/history.js';
import { getAllPricing, getProviderPricing } from '../../core/pricing.js';
import { getAllProviderNames, createProvider } from '../../providers/index.js';

export function createCostCommand(): Command {
  const cmd = new Command('cost')
    .description('Cost tracking and pricing information');

  cmd
    .command('summary')
    .description('Show total spend from generation history')
    .action(async () => {
      const chalk = (await import('chalk')).default;

      const entries = loadHistory();

      if (entries.length === 0) {
        console.log(chalk.dim('\n  No history entries. Generate some videos first.\n'));
        return;
      }

      // Aggregate by provider
      const byProvider: Record<string, { count: number; totalCost: number; totalDuration: number }> = {};
      let totalCost = 0;
      let totalDuration = 0;

      for (const entry of entries) {
        /* v8 ignore next 2 */
        const cost = entry.cost || 0;
        const duration = entry.duration || 0;
        totalCost += cost;
        totalDuration += duration;

        if (!byProvider[entry.provider]) {
          byProvider[entry.provider] = { count: 0, totalCost: 0, totalDuration: 0 };
        }
        byProvider[entry.provider].count++;
        byProvider[entry.provider].totalCost += cost;
        byProvider[entry.provider].totalDuration += duration;
      }

      console.log(chalk.bold('\n  💰 VideoForge — Cost Summary\n'));

      // Per-provider breakdown
      const header = [
        'Provider'.padEnd(12),
        'Videos'.padEnd(10),
        'Duration'.padEnd(12),
        'Total Cost',
      ].join('  ');
      console.log(chalk.dim(`  ${header}`));
      console.log(chalk.dim(`  ${'─'.repeat(50)}`));

      for (const [name, data] of Object.entries(byProvider)) {
        const row = [
          chalk.bold(name.padEnd(12)),
          String(data.count).padEnd(10),
          `${data.totalDuration}s`.padEnd(12),
          `$${data.totalCost.toFixed(4)}`,
        ].join('  ');
        console.log(`  ${row}`);
      }

      console.log(chalk.dim(`  ${'─'.repeat(50)}`));
      console.log(chalk.bold(`  ${'Total'.padEnd(12)}  ${String(entries.length).padEnd(10)}  ${`${totalDuration}s`.padEnd(12)}  $${totalCost.toFixed(4)}`));
      console.log('');
    });

  cmd
    .command('pricing')
    .description('Show pricing table for all providers')
    .action(async () => {
      const chalk = (await import('chalk')).default;

      const allPricing = getAllPricing();

      console.log(chalk.bold('\n  💰 VideoForge — Provider Pricing\n'));

      for (const providerName of getAllProviderNames()) {
        const provider = createProvider(providerName);
        const pricing = allPricing[providerName];

        console.log(chalk.bold(`  ${provider.info.displayName}`));
        console.log(chalk.dim(`  ${provider.info.pricing.unit}\n`));

        if (pricing && Object.keys(pricing).length > 0) {
          for (const [model, entry] of Object.entries(pricing)) {
            console.log(`    ${model.padEnd(35)} $${entry.rate.toFixed(4)} / ${entry.unit}`);
          }
        } else {
          console.log(chalk.dim('    No pricing data available'));
        }

        console.log('');
      }
    });

  return cmd;
}
