import { Command } from 'commander';
import { OutputFormat } from '../notebook/types.js';

const VERSION = '0.0.1';

interface SelfOptions {
  format: OutputFormat;
}

export function selfCommand(): Command {
  const cmd = new Command('self');
  cmd.description('Manage nb CLI (version, update)');

  // Version subcommand
  const versionCmd = new Command('version');
  versionCmd
    .description('Show version information')
    .option('-f, --format <format>', 'Output format (json|text)', 'json')
    .action(async (options: SelfOptions) => {
      await executeVersion(options);
    });

  // Update subcommand
  const updateCmd = new Command('update');
  updateCmd
    .description('Update nb CLI to latest version')
    .option('-f, --format <format>', 'Output format (json|text)', 'json')
    .action(async (options: SelfOptions) => {
      await executeUpdate(options);
    });

  cmd.addCommand(versionCmd);
  cmd.addCommand(updateCmd);

  return cmd;
}

async function executeVersion(options: SelfOptions): Promise<void> {
  if (options.format === OutputFormat.JSON) {
    console.log(
      JSON.stringify(
        {
          version: VERSION,
          runtime: 'bun',
          runtime_version: Bun.version,
        },
        null,
        2
      )
    );
  } else {
    console.log(`nb CLI version ${VERSION}`);
    console.log(`Runtime: Bun ${Bun.version}`);
  }
}

async function executeUpdate(options: SelfOptions): Promise<void> {
  // TODO: Implement self-update functionality
  if (options.format === OutputFormat.JSON) {
    console.log(
      JSON.stringify(
        {
          status: 'not_implemented',
          message: 'Self-update not yet implemented',
        },
        null,
        2
      )
    );
  } else {
    console.log('Self-update not yet implemented');
    console.log('To update, run: bun update @jupyter-ai-contrib/nb-cli');
  }
}
