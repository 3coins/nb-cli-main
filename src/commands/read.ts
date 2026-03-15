import { Command } from 'commander';
import type { ICodeCell } from '@jupyterlab/nbformat';
import { readNotebook } from '../notebook/io.js';
import { findCell, getCellSource } from '../notebook/operations.js';
import { OutputFormat } from '../notebook/types.js';

interface ReadOptions {
  cellIndex?: number;
  cell?: string;
  withOutputs: boolean;
  onlyCode: boolean;
  onlyMarkdown: boolean;
  format: OutputFormat;
}

export function readCommand(): Command {
  const cmd = new Command('read');

  cmd
    .description('Read and extract notebook content')
    .argument('<path>', 'Path to notebook file')
    .option('-i, --cell-index <index>', 'Cell index to read', parseInt)
    .option('-c, --cell <id>', 'Cell id to read')
    .option('--with-outputs', 'Include cell outputs', false)
    .option('--only-code', 'Show only code cells', false)
    .option('--only-markdown', 'Show only markdown cells', false)
    .option('-f, --format <format>', 'Output format (json|text)', 'json')
    .action(async (path: string, options: ReadOptions) => {
      await executeRead(path, options);
    });

  return cmd;
}

async function executeRead(path: string, options: ReadOptions): Promise<void> {
  const notebook = await readNotebook(path);

  // If specific cell requested
  if (options.cellIndex !== undefined || options.cell) {
    const { cell, index } = findCell(notebook, {
      index: options.cellIndex,
      id: options.cell,
    });

    if (options.format === OutputFormat.JSON) {
      const result = {
        index,
        id: cell.id,
        cell_type: cell.cell_type,
        source: getCellSource(cell),
        ...(options.withOutputs && cell.cell_type === 'code'
          ? { outputs: (cell as ICodeCell).outputs, execution_count: (cell as ICodeCell).execution_count }
          : {}),
      };
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Cell ${index} (${cell.id}):`);
      console.log(`Type: ${cell.cell_type}`);
      console.log(`\nSource:\n${getCellSource(cell)}`);
      if (options.withOutputs && cell.cell_type === 'code') {
        const codeCell = cell as ICodeCell;
        console.log(`\nExecution count: ${codeCell.execution_count ?? 'null'}`);
        console.log(`Outputs: ${JSON.stringify(codeCell.outputs, null, 2)}`);
      }
    }
    return;
  }

  // Filter cells if requested
  let cells = notebook.cells;
  if (options.onlyCode) {
    cells = cells.filter((c) => c.cell_type === 'code');
  } else if (options.onlyMarkdown) {
    cells = cells.filter((c) => c.cell_type === 'markdown');
  }

  if (options.format === OutputFormat.JSON) {
    const result = {
      cells: cells.map((cell, index) => ({
        index,
        id: cell.id,
        cell_type: cell.cell_type,
        source: getCellSource(cell),
        ...(options.withOutputs && cell.cell_type === 'code'
          ? { outputs: (cell as ICodeCell).outputs, execution_count: (cell as ICodeCell).execution_count }
          : {}),
      })),
      metadata: notebook.metadata,
      nbformat: notebook.nbformat,
      nbformat_minor: notebook.nbformat_minor,
    };
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Notebook: ${notebook.cells.length} cells`);
    console.log(`Format: v${notebook.nbformat}.${notebook.nbformat_minor}`);
    if (notebook.metadata.kernelspec) {
      console.log(`Kernel: ${notebook.metadata.kernelspec.display_name}`);
    }
    console.log('');

    cells.forEach((cell, index) => {
      console.log(`[${index}] ${cell.cell_type} (${cell.id}):`);
      console.log(getCellSource(cell));
      if (options.withOutputs && cell.cell_type === 'code') {
        const codeCell = cell as ICodeCell;
        if (codeCell.outputs.length > 0) {
          console.log(`Outputs: ${JSON.stringify(codeCell.outputs, null, 2)}`);
        }
      }
      console.log('');
    });
  }
}
