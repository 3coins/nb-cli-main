import { v4 as uuidv4 } from 'uuid';
import type { ICell, ICodeCell, IMarkdownCell, IRawCell } from '@jupyterlab/nbformat';
import type { Notebook, CellReference } from './types.js';
import { CellType, Template } from './types.js';

/**
 * Create a new notebook with specified template
 */
export function createNotebook(
  kernel: string = 'python3',
  language: string = 'python',
  template: Template = Template.EMPTY
): Notebook {
  // Create kernel spec matching Jupyter conventions
  let displayName: string;
  if (language === 'python' && kernel === 'python3') {
    displayName = 'Python 3 (ipykernel)';
  } else if (language === 'python') {
    displayName = `Python 3 (${kernel})`;
  } else if (language === kernel) {
    displayName = kernel;
  } else {
    displayName = `${language} (${kernel})`;
  }

  const notebook: Notebook = {
    cells: [],
    metadata: {
      kernelspec: {
        name: kernel,
        display_name: displayName,
        language: language,
      },
    },
    nbformat: 4,
    nbformat_minor: 5,
  };

  // Add cells based on template
  switch (template) {
    case Template.BASIC:
      notebook.cells.push(createEmptyCodeCell());
      break;
    case Template.MARKDOWN:
      notebook.cells.push(createMarkdownCell('# New Notebook\n'));
      notebook.cells.push(createEmptyCodeCell());
      break;
    case Template.EMPTY:
    default:
      // No cells
      break;
  }

  return notebook;
}

/**
 * Create an empty code cell
 */
export function createEmptyCodeCell(): ICodeCell {
  return {
    cell_type: 'code',
    id: uuidv4(),
    metadata: {},
    execution_count: null,
    source: [],
    outputs: [],
  };
}

/**
 * Create a markdown cell with content
 */
export function createMarkdownCell(source: string): IMarkdownCell {
  return {
    cell_type: 'markdown',
    id: uuidv4(),
    metadata: {},
    source: source,
  };
}

/**
 * Create a raw cell with content
 */
export function createRawCell(source: string): IRawCell {
  return {
    cell_type: 'raw',
    id: uuidv4(),
    metadata: {},
    source: source,
  };
}

/**
 * Create a new cell with specified type and source
 */
export function createCell(type: CellType, source: string): ICell {
  switch (type) {
    case CellType.CODE:
      const codeCell = createEmptyCodeCell();
      codeCell.source = source;
      return codeCell;
    case CellType.MARKDOWN:
      return createMarkdownCell(source);
    case CellType.RAW:
      return createRawCell(source);
    default:
      throw new Error(`Unknown cell type: ${type}`);
  }
}

/**
 * Find a cell by reference (index or id)
 */
export function findCell(notebook: Notebook, ref: CellReference): { cell: ICell; index: number } {
  if (ref.id !== undefined) {
    const index = notebook.cells.findIndex((cell) => cell.id === ref.id);
    if (index === -1) {
      throw new Error(`Cell with id '${ref.id}' not found`);
    }
    return { cell: notebook.cells[index], index };
  }

  if (ref.index !== undefined) {
    let index = ref.index;
    // Handle negative indexing
    if (index < 0) {
      index = notebook.cells.length + index;
    }

    if (index < 0 || index >= notebook.cells.length) {
      throw new Error(`Cell index ${ref.index} out of range (0-${notebook.cells.length - 1})`);
    }

    return { cell: notebook.cells[index], index };
  }

  throw new Error('Either cell index or id must be specified');
}

/**
 * Add a cell to the notebook
 */
export function addCell(
  notebook: Notebook,
  source: string,
  type: CellType = CellType.CODE,
  index?: number
): Notebook {
  const cell = createCell(type, source);

  if (index !== undefined) {
    // Handle negative indexing
    let targetIndex = index;
    if (targetIndex < 0) {
      targetIndex = notebook.cells.length + targetIndex + 1;
    }

    if (targetIndex < 0 || targetIndex > notebook.cells.length) {
      throw new Error(`Index ${index} out of range (0-${notebook.cells.length})`);
    }

    notebook.cells.splice(targetIndex, 0, cell);
  } else {
    notebook.cells.push(cell);
  }

  return notebook;
}

/**
 * Update a cell in the notebook
 */
export function updateCell(
  notebook: Notebook,
  ref: CellReference,
  source?: string,
  append?: string,
  type?: CellType
): Notebook {
  const { cell, index } = findCell(notebook, ref);

  if (type !== undefined && cell.cell_type !== type) {
    // Replace cell with new type
    const newCell = createCell(type, source || '');
    notebook.cells[index] = newCell;
  } else {
    // Update existing cell
    if (source !== undefined) {
      cell.source = source;
    } else if (append !== undefined) {
      const currentSource = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
      cell.source = currentSource + append;
    }

    // Clear outputs if it's a code cell and source changed
    if (cell.cell_type === 'code' && (source !== undefined || append !== undefined)) {
      (cell as ICodeCell).execution_count = null;
      (cell as ICodeCell).outputs = [];
    }
  }

  return notebook;
}

/**
 * Delete a cell from the notebook
 */
export function deleteCell(notebook: Notebook, ref: CellReference): Notebook {
  const { index } = findCell(notebook, ref);
  notebook.cells.splice(index, 1);
  return notebook;
}

/**
 * Clear outputs from all code cells or specific cell
 */
export function clearOutputs(notebook: Notebook, ref?: CellReference): Notebook {
  if (ref) {
    const { cell } = findCell(notebook, ref);
    if (cell.cell_type === 'code') {
      (cell as ICodeCell).execution_count = null;
      (cell as ICodeCell).outputs = [];
    }
  } else {
    // Clear all code cells
    notebook.cells.forEach((cell) => {
      if (cell.cell_type === 'code') {
        (cell as ICodeCell).execution_count = null;
        (cell as ICodeCell).outputs = [];
      }
    });
  }

  return notebook;
}

/**
 * Get cell source as string
 */
export function getCellSource(cell: ICell): string {
  return Array.isArray(cell.source) ? cell.source.join('') : cell.source;
}

/**
 * Search for pattern in notebook cells
 */
export function searchCells(
  notebook: Notebook,
  pattern?: string,
  withErrors: boolean = false
): { cell: ICell; index: number }[] {
  const results: { cell: ICell; index: number }[] = [];

  notebook.cells.forEach((cell, index) => {
    let matches = false;

    // Check for errors if requested
    if (withErrors && cell.cell_type === 'code') {
      const codeCell = cell as ICodeCell;
      if (codeCell.outputs.some((output) => output.output_type === 'error')) {
        matches = true;
      }
    }

    // Check for pattern match
    if (pattern) {
      const source = getCellSource(cell);
      const regex = new RegExp(pattern);
      if (regex.test(source)) {
        matches = true;
      }
    }

    if (matches || (!pattern && !withErrors)) {
      results.push({ cell, index });
    }
  });

  return results;
}
