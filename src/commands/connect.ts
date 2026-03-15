import { Command } from 'commander';
import { render } from 'ink';
import React from 'react';
import { OutputFormat } from '../notebook/types.js';
import { writeConfig } from '../config/index.js';
import {
  discoverServers,
  validateServer,
  getServerInfo,
} from '../execution/remote/discovery.js';
import { ServerSelector } from '../ui/components/ServerSelector.js';

interface ConnectOptions {
  server?: string;
  token?: string;
  format: string;
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
  const format = parseFormat(options.format);

  // If server and token are provided, use them
  if (options.server && options.token) {
    await connectToServer(options.server, options.token, format);
    return;
  }

  // Otherwise, discover servers
  if (format === OutputFormat.TEXT) {
    console.log('Discovering Jupyter servers...');
  }

  const servers = await discoverServers();

  if (servers.length === 0) {
    throw new Error(
      'No running Jupyter servers found. Please start a Jupyter server or provide --server and --token.'
    );
  }

  // Validate servers
  const validServers = [];
  for (const server of servers) {
    const isValid = await validateServer(server.url, server.token);
    if (isValid) {
      validServers.push(server);
    }
  }

  if (validServers.length === 0) {
    throw new Error('No valid Jupyter servers found.');
  }

  // If only one server, connect to it
  if (validServers.length === 1) {
    await connectToServer(validServers[0].url, validServers[0].token, format);
    return;
  }

  // Multiple servers, show selection UI
  await selectServer(validServers, format);
}

async function selectServer(servers: any[], format: OutputFormat): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSelect = async (server: any) => {
      app.unmount();
      try {
        await connectToServer(server.url, server.token, format);
        resolve();
      } catch (error) {
        reject(error);
      }
    };

    const onCancel = () => {
      app.unmount();
      reject(new Error('Connection cancelled'));
    };

    const app = render(
      React.createElement(ServerSelector, {
        servers,
        onSelect,
        onCancel,
      })
    );
  });
}

async function connectToServer(
  server: string,
  token: string,
  format: OutputFormat
): Promise<void> {
  // Validate server
  if (format === OutputFormat.TEXT) {
    console.log(`Connecting to ${server}...`);
  }

  const isValid = await validateServer(server, token);
  if (!isValid) {
    throw new Error(`Failed to connect to ${server}. Please check the URL and token.`);
  }

  // Get server info
  const info = await getServerInfo(server, token);

  // Save connection config
  await writeConfig({
    server,
    token,
    connected_at: new Date().toISOString(),
  });

  if (format === OutputFormat.JSON) {
    console.log(
      JSON.stringify(
        {
          status: 'connected',
          server,
          version: info.version,
        },
        null,
        2
      )
    );
  } else {
    console.log(`Connected to ${server}`);
    console.log(`Jupyter version: ${info.version}`);
  }
}

function parseFormat(formatStr: string): OutputFormat {
  const lower = formatStr.toLowerCase();
  switch (lower) {
    case 'json':
      return OutputFormat.JSON;
    case 'text':
      return OutputFormat.TEXT;
    default:
      throw new Error(`Unknown format: ${formatStr}. Use json or text.`);
  }
}
