import { Command } from 'commander';
import { loadConfig, setConfigValue, getConfigValue, getConfigPath } from '../../core/config.js';

const PROVIDER_NAMES = ['runway', 'fal', 'replicate', 'veo', 'sora'];

function normalizeKey(key: string): string {
  const parts = key.split('.');
  if (parts.length >= 2 && PROVIDER_NAMES.includes(parts[0])) {
    return key;
  }
  const defaultKeys = ['provider', 'duration', 'resolution', 'aspectRatio', 'fps', 'format', 'preset', 'audio'];
  if (parts.length === 1 && defaultKeys.includes(parts[0])) {
    return `defaults.${key}`;
  }
  return key;
}

function maskSensitive(key: string, value: string): string {
  if (key.toLowerCase().includes('apikey') || key.toLowerCase().includes('key')) {
    if (value.length > 10) {
      return value.slice(0, 6) + '...' + value.slice(-4);
    }
    return '****';
  }
  return value;
}

export function createConfigCommand(): Command {
  const cmd = new Command('config')
    .description('Manage VideoForge configuration');

  cmd
    .command('set <key> <value>')
    .description('Set a config value (e.g., runway.apiKey your-key)')
    .action(async (key: string, value: string) => {
      const chalk = (await import('chalk')).default;

      const fullKey = normalizeKey(key);
      setConfigValue(fullKey, value);

      const display = maskSensitive(fullKey, value);
      console.log(chalk.green(`\n  ✓ Set ${key} = ${display}\n`));
    });

  cmd
    .command('get <key>')
    .description('Get a config value')
    .action(async (key: string) => {
      const chalk = (await import('chalk')).default;

      const fullKey = normalizeKey(key);
      const value = getConfigValue(fullKey);

      if (value === undefined) {
        console.log(chalk.yellow(`\n  ⚠ Key "${key}" not found\n`));
      } else {
        const display = typeof value === 'object'
          ? JSON.stringify(value, null, 2)
          : String(value);
        const masked = typeof value === 'string' ? maskSensitive(fullKey, display) : display;
        console.log(`\n  ${key} = ${masked}\n`);
      }
    });

  cmd
    .command('list')
    .description('Show all configuration')
    .action(async () => {
      const chalk = (await import('chalk')).default;

      const config = loadConfig();

      console.log(chalk.bold('\n  📋 VideoForge Configuration'));
      console.log(chalk.dim(`  File: ${getConfigPath()}\n`));

      console.log(chalk.bold('  Providers:'));
      for (const name of PROVIDER_NAMES) {
        const providerConfig = config[name] as Record<string, unknown> | undefined;
        const hasKey = providerConfig?.apiKey && String(providerConfig.apiKey).length > 0;
        const status = hasKey ? chalk.green('✓ configured') : chalk.dim('✗ no key');
        console.log(`    ${name.padEnd(14)} ${status}`);
      }

      console.log(chalk.bold('\n  Defaults:'));
      const defaults = config.defaults || {};
      console.log(`    Provider:    ${defaults.provider || chalk.dim('not set')}`);
      console.log(`    Duration:    ${defaults.duration || chalk.dim('5')}s`);
      console.log(`    Resolution:  ${defaults.resolution || chalk.dim('not set')}`);
      console.log(`    Aspect:      ${defaults.aspectRatio || chalk.dim('not set')}`);
      console.log(`    Format:      ${defaults.format || chalk.dim('mp4')}`);
      console.log(`    Preset:      ${defaults.preset || chalk.dim('not set')}`);

      console.log(chalk.bold('\n  Output:'));
      const output = config.output || {};
      console.log(`    Directory:   ${output.directory || chalk.dim('current directory')}`);
      console.log(`    Auto-open:   ${output.autoOpen ? 'yes' : chalk.dim('no')}`);

      console.log(chalk.bold('\n  History:'));
      const history = config.history || {};
      /* v8 ignore next */
      console.log(`    Enabled:     ${history.enabled !== false ? 'yes' : 'no'}`);
      console.log(`    Max entries: ${history.maxEntries || chalk.dim('100')}`);
      console.log('');
    });

  return cmd;
}
