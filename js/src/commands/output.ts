import { Command } from 'commander';
import { readNotebook, writeNotebookAtomic } from '../notebook/io.js';
import { clearOutputs } from '../notebook/operations.js';
import { OutputFormat } from '../notebook/types.js';

interface ClearOutputsOptions {
  cellIndex?: number;
  cell?: string;
  format: OutputFormat;
}

export function outputCommand(): Command {
  const cmd = new Command('output');
  cmd.description('Clear outputs');

  const clearCmd = new Command('clear');
  clearCmd
    .description('Clear outputs from code cells')
    .argument('<path>', 'Path to notebook file')
    .option('-i, --cell-index <index>', 'Cell index', parseInt)
    .option('-c, --cell <id>', 'Cell id')
    .option('-f, --format <format>', 'Output format (json|text)', 'json')
    .action(async (path: string, options: ClearOutputsOptions) => {
      await executeClearOutputs(path, options);
    });

  cmd.addCommand(clearCmd);
  return cmd;
}

async function executeClearOutputs(path: string, options: ClearOutputsOptions): Promise<void> {
  const notebook = await readNotebook(path);

  // Clear outputs
  if (options.cellIndex !== undefined || options.cell) {
    clearOutputs(notebook, { index: options.cellIndex, id: options.cell });
  } else {
    clearOutputs(notebook);
  }

  // Write notebook
  await writeNotebookAtomic(path, notebook);

  const result = {
    file: path,
    action: 'cleared_outputs',
  };

  if (options.format === OutputFormat.JSON) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Cleared outputs in ${path}`);
  }
}
