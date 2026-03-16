import { Command } from 'commander';
import type { ICodeCell } from '@jupyterlab/nbformat';
import { readNotebook } from '../notebook/io.js';
import { searchCells, getCellSource } from '../notebook/operations.js';
import { OutputFormat } from '../notebook/types.js';

interface SearchOptions {
  withErrors: boolean;
  format: OutputFormat;
}

export function searchCommand(): Command {
  const cmd = new Command('search');

  cmd
    .description('Search for text and errors in notebook cells')
    .argument('<path>', 'Path to notebook file')
    .argument('[pattern]', 'Search pattern (regex)')
    .option('--with-errors', 'Find cells with errors', false)
    .option('-f, --format <format>', 'Output format (json|text)', 'json')
    .action(async (path: string, pattern: string | undefined, options: SearchOptions) => {
      await executeSearch(path, pattern, options);
    });

  return cmd;
}

async function executeSearch(
  path: string,
  pattern: string | undefined,
  options: SearchOptions
): Promise<void> {
  const notebook = await readNotebook(path);
  const results = searchCells(notebook, pattern, options.withErrors);

  if (options.format === OutputFormat.JSON) {
    const output = {
      matches: results.length,
      cells: results.map(({ cell, index }) => ({
        index,
        id: cell.id,
        cell_type: cell.cell_type,
        source: getCellSource(cell),
        ...(cell.cell_type === 'code' && options.withErrors
          ? {
              has_error: (cell as ICodeCell).outputs.some((o) => o.output_type === 'error'),
              outputs: (cell as ICodeCell).outputs,
            }
          : {}),
      })),
    };
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`Found ${results.length} matching cells:\n`);
    results.forEach(({ cell, index }) => {
      console.log(`[${index}] ${cell.cell_type} (${cell.id}):`);
      console.log(getCellSource(cell));
      if (cell.cell_type === 'code' && options.withErrors) {
        const codeCell = cell as ICodeCell;
        const errorOutputs = codeCell.outputs.filter((o) => o.output_type === 'error');
        if (errorOutputs.length > 0) {
          console.log(`\nErrors: ${JSON.stringify(errorOutputs, null, 2)}`);
        }
      }
      console.log('');
    });
  }
}
