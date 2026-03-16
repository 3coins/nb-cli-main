import { Command } from 'commander';
import { readNotebook, writeNotebookAtomic } from '../notebook/io.js';
import { addCell, updateCell, deleteCell } from '../notebook/operations.js';
import { CellType, OutputFormat } from '../notebook/types.js';

interface AddCellOptions {
  source: string;
  type: string;
  index?: number;
  format: OutputFormat;
}

interface UpdateCellOptions {
  cellIndex?: number;
  cell?: string;
  source?: string;
  append?: string;
  type?: string;
  format: OutputFormat;
}

interface DeleteCellOptions {
  cellIndex?: number;
  cell?: string;
  format: OutputFormat;
}

export function cellCommand(): Command {
  const cmd = new Command('cell');
  cmd.description('Add, update or delete cells');

  // Add subcommand
  const addCmd = new Command('add');
  addCmd
    .description('Add a new cell to a notebook')
    .argument('<path>', 'Path to notebook file')
    .requiredOption('-s, --source <code>', 'Cell source code')
    .option('-t, --type <type>', 'Cell type (code|markdown|raw)', 'code')
    .option('-i, --index <index>', 'Insert at index', parseInt)
    .option('-f, --format <format>', 'Output format (json|text)', 'json')
    .action(async (path: string, options: AddCellOptions) => {
      await executeAddCell(path, options);
    });

  // Update subcommand
  const updateCmd = new Command('update');
  updateCmd
    .description('Update an existing cell')
    .argument('<path>', 'Path to notebook file')
    .option('-i, --cell-index <index>', 'Cell index', parseInt)
    .option('-c, --cell <id>', 'Cell id')
    .option('-s, --source <code>', 'New cell source')
    .option('--append <code>', 'Append to cell source')
    .option('-t, --type <type>', 'Change cell type (code|markdown|raw)')
    .option('-f, --format <format>', 'Output format (json|text)', 'json')
    .action(async (path: string, options: UpdateCellOptions) => {
      await executeUpdateCell(path, options);
    });

  // Delete subcommand
  const deleteCmd = new Command('delete');
  deleteCmd
    .description('Delete cells from a notebook')
    .argument('<path>', 'Path to notebook file')
    .option('-i, --cell-index <index>', 'Cell index', parseInt)
    .option('-c, --cell <id>', 'Cell id')
    .option('-f, --format <format>', 'Output format (json|text)', 'json')
    .action(async (path: string, options: DeleteCellOptions) => {
      await executeDeleteCell(path, options);
    });

  cmd.addCommand(addCmd);
  cmd.addCommand(updateCmd);
  cmd.addCommand(deleteCmd);

  return cmd;
}

async function executeAddCell(path: string, options: AddCellOptions): Promise<void> {
  const notebook = await readNotebook(path);

  // Parse cell type
  const cellType = parseCellType(options.type);

  // Process escape sequences in source
  const source = processEscapeSequences(options.source);

  // Add cell
  addCell(notebook, source, cellType, options.index);

  // Write notebook
  await writeNotebookAtomic(path, notebook);

  const result = {
    file: path,
    action: 'added',
    cell_count: notebook.cells.length,
  };

  if (options.format === OutputFormat.JSON) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Added cell to ${path}`);
    console.log(`Total cells: ${result.cell_count}`);
  }
}

async function executeUpdateCell(path: string, options: UpdateCellOptions): Promise<void> {
  if (options.cellIndex === undefined && !options.cell) {
    throw new Error('Either --cell-index or --cell must be specified');
  }

  if (!options.source && !options.append && !options.type) {
    throw new Error('At least one of --source, --append, or --type must be specified');
  }

  const notebook = await readNotebook(path);

  // Process escape sequences
  const source = options.source ? processEscapeSequences(options.source) : undefined;
  const append = options.append ? processEscapeSequences(options.append) : undefined;
  const cellType = options.type ? parseCellType(options.type) : undefined;

  // Update cell
  updateCell(
    notebook,
    { index: options.cellIndex, id: options.cell },
    source,
    append,
    cellType
  );

  // Write notebook
  await writeNotebookAtomic(path, notebook);

  const result = {
    file: path,
    action: 'updated',
    cell_count: notebook.cells.length,
  };

  if (options.format === OutputFormat.JSON) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Updated cell in ${path}`);
  }
}

async function executeDeleteCell(path: string, options: DeleteCellOptions): Promise<void> {
  if (options.cellIndex === undefined && !options.cell) {
    throw new Error('Either --cell-index or --cell must be specified');
  }

  const notebook = await readNotebook(path);

  // Delete cell
  deleteCell(notebook, { index: options.cellIndex, id: options.cell });

  // Write notebook
  await writeNotebookAtomic(path, notebook);

  const result = {
    file: path,
    action: 'deleted',
    cell_count: notebook.cells.length,
  };

  if (options.format === OutputFormat.JSON) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Deleted cell from ${path}`);
    console.log(`Total cells: ${result.cell_count}`);
  }
}

function parseCellType(typeStr: string): CellType {
  const lower = typeStr.toLowerCase();
  switch (lower) {
    case 'code':
      return CellType.CODE;
    case 'markdown':
      return CellType.MARKDOWN;
    case 'raw':
      return CellType.RAW;
    default:
      throw new Error(`Unknown cell type: ${typeStr}. Use code, markdown, or raw.`);
  }
}

function processEscapeSequences(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\\\/g, '\\');
}
