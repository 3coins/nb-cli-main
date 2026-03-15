import { Command } from 'commander';
import { readNotebook } from '../notebook/io.js';
import { findCell } from '../notebook/operations.js';
import { OutputFormat } from '../notebook/types.js';
import { LocalExecutor } from '../execution/local/executor.js';
import { isConnected } from '../config/index.js';

interface ExecuteOptions {
  cellIndex?: number;
  cell?: string;
  timeout?: number;
  format: string;
}

export function executeCommand(): Command {
  const cmd = new Command('execute');

  cmd
    .description('Execute cells in a notebook')
    .argument('<path>', 'Path to notebook file')
    .option('-i, --cell-index <index>', 'Cell index to execute', parseInt)
    .option('-c, --cell <id>', 'Cell id to execute')
    .option('--timeout <ms>', 'Execution timeout in milliseconds', parseInt)
    .option('-f, --format <format>', 'Output format (json|text)', 'json')
    .action(async (path: string, options: ExecuteOptions) => {
      await executeNotebook(path, options);
    });

  return cmd;
}

async function executeNotebook(path: string, options: ExecuteOptions): Promise<void> {
  const format = parseFormat(options.format);

  // Check if connected to remote server
  const connected = await isConnected();
  if (connected) {
    throw new Error('Remote execution not yet implemented');
  }

  // Use local execution
  const executor = new LocalExecutor({
    timeout: options.timeout ? options.timeout / 1000 : undefined, // Convert ms to seconds
  });

  try {
    await executor.initialize();
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Failed to initialize executor'
    );
  }

  // Execute specific cell or entire notebook
  if (options.cellIndex !== undefined || options.cell) {
    const notebook = await readNotebook(path);
    const { index } = findCell(notebook, {
      index: options.cellIndex,
      id: options.cell,
    });

    const timeoutSec = options.timeout ? options.timeout / 1000 : 60;
    const result = await executor.executeCell(path, index, timeoutSec);

    if (!result.success) {
      throw new Error(result.error || 'Execution failed');
    }

    if (format === OutputFormat.JSON) {
      console.log(
        JSON.stringify(
          {
            success: true,
            cell_index: index,
            execution_count: result.execution_count,
            outputs: result.outputs,
          },
          null,
          2
        )
      );
    } else {
      console.log(`Executed cell ${index}`);
      console.log(`Execution count: ${result.execution_count}`);
      if (result.outputs.length > 0) {
        console.log(`Outputs: ${JSON.stringify(result.outputs, null, 2)}`);
      }
    }
  } else {
    const timeoutSec = options.timeout ? options.timeout / 1000 : 600;
    const result = await executor.executeNotebook(path, timeoutSec);

    if (!result.success) {
      throw new Error(result.error || 'Execution failed');
    }

    if (format === OutputFormat.JSON) {
      console.log(
        JSON.stringify(
          {
            success: true,
            file: path,
          },
          null,
          2
        )
      );
    } else {
      console.log(`Executed notebook: ${path}`);
    }
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
