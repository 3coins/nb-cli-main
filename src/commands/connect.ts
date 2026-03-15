import { Command } from 'commander';
import { OutputFormat } from '../notebook/types.js';

interface ConnectOptions {
  server?: string;
  token?: string;
  format: OutputFormat;
}

export function connectCommand(): Command {
  const cmd = new Command('connect');

  cmd
    .description('Connect to a Jupyter server')
    .option('--server <url>', 'Server URL')
    .option('--token <token>', 'Authentication token')
    .option('-f, --format <format>', 'Output format (json|text)', 'json')
    .action(async (options: ConnectOptions) => {
      await executeConnect(options);
    });

  return cmd;
}

async function executeConnect(options: ConnectOptions): Promise<void> {
  // TODO: Implement connection
  throw new Error('Connect command not yet implemented');
}
