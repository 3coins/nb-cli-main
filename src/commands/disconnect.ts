import { Command } from 'commander';
import { deleteConfig, readConfig } from '../config/index.js';
import { OutputFormat } from '../notebook/types.js';

interface DisconnectOptions {
  format: OutputFormat;
}

export function disconnectCommand(): Command {
  const cmd = new Command('disconnect');

  cmd
    .description('Disconnect from Jupyter server')
    .option('-f, --format <format>', 'Output format (json|text)', 'json')
    .action(async (options: DisconnectOptions) => {
      await executeDisconnect(options);
    });

  return cmd;
}

async function executeDisconnect(options: DisconnectOptions): Promise<void> {
  const config = await readConfig();

  if (!config) {
    if (options.format === OutputFormat.JSON) {
      console.log(JSON.stringify({ status: 'not_connected' }, null, 2));
    } else {
      console.log('Not connected to any server');
    }
    return;
  }

  await deleteConfig();

  if (options.format === OutputFormat.JSON) {
    console.log(
      JSON.stringify(
        {
          status: 'disconnected',
          server: config.server,
        },
        null,
        2
      )
    );
  } else {
    console.log(`Disconnected from ${config.server}`);
  }
}
