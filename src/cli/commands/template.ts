import { Command } from 'commander';
import { loadTemplates, addTemplate, removeTemplate, getTemplate, renderTemplate } from '../../core/templates.js';

export function createTemplateCommand(): Command {
  const cmd = new Command('template')
    .description('Manage prompt templates');

  cmd
    .command('save <name> <prompt>')
    .description('Save a prompt template')
    .option('-p, --provider <name>', 'Default provider for this template')
    .option('-d, --duration <seconds>', 'Default duration')
    .option('-r, --resolution <res>', 'Default resolution')
    .option('-s, --preset <style>', 'Default style preset')
    .action(async (name: string, prompt: string, options: {
      provider?: string;
      duration?: string;
      resolution?: string;
      preset?: string;
    }) => {
      const chalk = (await import('chalk')).default;

      addTemplate({
        name,
        prompt,
        provider: options.provider,
        /* v8 ignore next */
        duration: options.duration ? parseInt(options.duration) : undefined,
        resolution: options.resolution,
        preset: options.preset,
      });

      console.log(chalk.green(`\n  ✓ Template "${name}" saved`));
      /* v8 ignore start */
      console.log(chalk.dim(`  Prompt: "${prompt.slice(0, 60)}${prompt.length > 60 ? '...' : ''}"`));
      if (options.provider) console.log(chalk.dim(`  Provider: ${options.provider}`));
      if (options.duration) console.log(chalk.dim(`  Duration: ${options.duration}s`));
      /* v8 ignore stop */
      console.log('');
    });

  cmd
    .command('list')
    .alias('ls')
    .description('List all saved templates')
    .action(async () => {
      const chalk = (await import('chalk')).default;

      const templates = loadTemplates();

      if (templates.length === 0) {
        console.log(chalk.dim('\n  No templates saved yet.'));
        console.log(chalk.dim('  Save one: videoforge template save <name> "<prompt>"\n'));
        return;
      }

      console.log(chalk.bold(`\n  📝 Saved Templates (${templates.length})\n`));

      for (const tmpl of templates) {
        /* v8 ignore next 3 */
        const promptShort = tmpl.prompt.length > 50
          ? tmpl.prompt.slice(0, 50) + '...'
          : tmpl.prompt;

        console.log(`  ${chalk.bold(tmpl.name)}`);
        console.log(chalk.dim(`    Prompt:   "${promptShort}"`));
        /* v8 ignore start */
        if (tmpl.provider) console.log(chalk.dim(`    Provider: ${tmpl.provider}`));
        if (tmpl.duration) console.log(chalk.dim(`    Duration: ${tmpl.duration}s`));
        if (tmpl.resolution) console.log(chalk.dim(`    Resolution: ${tmpl.resolution}`));
        if (tmpl.preset) console.log(chalk.dim(`    Preset: ${tmpl.preset}`));
        /* v8 ignore stop */
        console.log('');
      }
    });

  cmd
    .command('use <name>')
    .description('Generate video using a saved template')
    .option('--var <key=value...>', 'Template variables', (val: string, prev: string[]) => {
      /* v8 ignore next */
      prev = prev || [];
      prev.push(val);
      return prev;
    }, [])
    .action(async (name: string, options: { var: string[] }) => {
      const chalk = (await import('chalk')).default;

      const tmpl = getTemplate(name);
      if (!tmpl) {
        console.error(chalk.red(`\n  ✗ Template "${name}" not found. Run: videoforge template list\n`));
        process.exit(1);
      }

      // Parse variables
      const vars: Record<string, string> = {};
      /* v8 ignore next */
      for (const v of options.var || []) {
        const [key, ...rest] = v.split('=');
        vars[key] = rest.join('=');
      }

      const rendered = renderTemplate(tmpl, vars);

      /* v8 ignore start */
      console.log(chalk.bold(`\n  📝 Template: ${name}`));
      console.log(chalk.dim(`  Rendered prompt: "${rendered.slice(0, 80)}${rendered.length > 80 ? '...' : ''}"`));
      console.log(chalk.dim(`\n  Run with:`));
      console.log(chalk.dim(`    videoforge generate "${rendered}" ${tmpl.provider ? `-p ${tmpl.provider}` : ''} ${tmpl.duration ? `-d ${tmpl.duration}` : ''}`));
      console.log('');
      /* v8 ignore stop */
    });

  cmd
    .command('remove <name>')
    .alias('rm')
    .description('Remove a saved template')
    .action(async (name: string) => {
      const chalk = (await import('chalk')).default;

      const removed = removeTemplate(name);

      if (removed) {
        console.log(chalk.green(`\n  ✓ Template "${name}" removed\n`));
      } else {
        console.error(chalk.red(`\n  ✗ Template "${name}" not found\n`));
        process.exit(1);
      }
    });

  return cmd;
}
