import { Command } from 'commander';
import { readConfig } from '../config/index.js';
import { OutputFormat } from '../notebook/types.js';

interface StatusOptions {
  format: OutputFormat;
}

export function statusCommand(): Command {
  const cmd = new Command('status');

  cmd
    .description('Show connection status')
    .option('-f, --format <format>', 'Output format (json|text)', 'json')
    .action(async (options: StatusOptions) => {
      await executeStatus(options);
    });

  return cmd;
}

async function executeStatus(options: StatusOptions): Promise<void> {
  const config = await readConfig();

  if (options.format === OutputFormat.JSON) {
    if (config) {
      console.log(
        JSON.stringify(
          {
            connected: true,
            server: config.server,
            connected_at: config.connected_at,
          },
          null,
          2
        )
      );
    } else {
      console.log(
        JSON.stringify(
          {
            connected: false,
          },
          null,
          2
        )
      );
    }
  } else {
    if (config) {
      console.log('Connected to Jupyter server');
      console.log(`Server: ${config.server}`);
      console.log(`Connected at: ${config.connected_at}`);
    } else {
      console.log('Not connected to any Jupyter server');
      console.log('Run "nb connect" to connect');
    }
  }
}
