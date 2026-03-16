import { describe, test, expect } from 'bun:test';
import {
  createNotebook,
  createCell,
  addCell,
  updateCell,
  deleteCell,
  findCell,
  clearOutputs,
  searchCells,
  getCellSource,
} from './operations.js';
import { Template, CellType } from './types.js';

describe('Notebook Operations', () => {
  describe('createNotebook', () => {
    test('creates empty notebook', () => {
      const notebook = createNotebook('python3', 'python', Template.EMPTY);
      expect(notebook.cells).toHaveLength(0);
      expect(notebook.nbformat).toBe(4);
      expect(notebook.metadata.kernelspec?.name).toBe('python3');
    });

    test('creates basic notebook with one code cell', () => {
      const notebook = createNotebook('python3', 'python', Template.BASIC);
      expect(notebook.cells).toHaveLength(1);
      expect(notebook.cells[0].cell_type).toBe('code');
    });

    test('creates markdown template notebook', () => {
      const notebook = createNotebook('python3', 'python', Template.MARKDOWN);
      expect(notebook.cells).toHaveLength(2);
      expect(notebook.cells[0].cell_type).toBe('markdown');
      expect(notebook.cells[1].cell_type).toBe('code');
    });

    test('sets correct kernel display name', () => {
      const notebook = createNotebook('python3', 'python', Template.EMPTY);
      expect(notebook.metadata.kernelspec?.display_name).toBe('Python 3 (ipykernel)');
    });
  });

  describe('createCell', () => {
    test('creates code cell', () => {
      const cell = createCell(CellType.CODE, 'print("hello")');
      expect(cell.cell_type).toBe('code');
      expect(getCellSource(cell)).toBe('print("hello")');
      expect(cell.id).toBeDefined();
    });

    test('creates markdown cell', () => {
      const cell = createCell(CellType.MARKDOWN, '# Title');
      expect(cell.cell_type).toBe('markdown');
      expect(getCellSource(cell)).toBe('# Title');
    });

    test('creates raw cell', () => {
      const cell = createCell(CellType.RAW, 'raw text');
      expect(cell.cell_type).toBe('raw');
      expect(getCellSource(cell)).toBe('raw text');
    });
  });

  describe('addCell', () => {
    test('adds cell to empty notebook', () => {
      const notebook = createNotebook('python3', 'python', Template.EMPTY);
      addCell(notebook, 'x = 1');
      expect(notebook.cells).toHaveLength(1);
      expect(getCellSource(notebook.cells[0])).toBe('x = 1');
    });

    test('adds cell at end by default', () => {
      const notebook = createNotebook('python3', 'python', Template.BASIC);
      addCell(notebook, 'x = 2');
      expect(notebook.cells).toHaveLength(2);
      expect(getCellSource(notebook.cells[1])).toBe('x = 2');
    });

    test('adds cell at specific index', () => {
      const notebook = createNotebook('python3', 'python', Template.BASIC);
      addCell(notebook, 'x = 1', CellType.CODE, 0);
      expect(notebook.cells).toHaveLength(2);
      expect(getCellSource(notebook.cells[0])).toBe('x = 1');
    });

    test('adds cell at negative index', () => {
      const notebook = createNotebook('python3', 'python', Template.BASIC);
      addCell(notebook, 'x = 1');
      addCell(notebook, 'x = 2', CellType.CODE, -1);
      expect(notebook.cells).toHaveLength(3);
      // -1 inserts before the last element
      expect(getCellSource(notebook.cells[2])).toBe('x = 2');
    });

    test('adds markdown cell', () => {
      const notebook = createNotebook('python3', 'python', Template.EMPTY);
      addCell(notebook, '# Title', CellType.MARKDOWN);
      expect(notebook.cells[0].cell_type).toBe('markdown');
    });
  });

  describe('findCell', () => {
    test('finds cell by index', () => {
      const notebook = createNotebook('python3', 'python', Template.BASIC);
      const { cell, index } = findCell(notebook, { index: 0 });
      expect(index).toBe(0);
      expect(cell).toBeDefined();
    });

    test('finds cell by negative index', () => {
      const notebook = createNotebook('python3', 'python', Template.BASIC);
      addCell(notebook, 'x = 1');
      const { cell, index } = findCell(notebook, { index: -1 });
      expect(index).toBe(1);
      expect(getCellSource(cell)).toBe('x = 1');
    });

    test('finds cell by id', () => {
      const notebook = createNotebook('python3', 'python', Template.BASIC);
      const cellId = notebook.cells[0].id;
      const { cell, index } = findCell(notebook, { id: cellId });
      expect(index).toBe(0);
      expect(cell.id).toBe(cellId);
    });

    test('throws error for out of range index', () => {
      const notebook = createNotebook('python3', 'python', Template.EMPTY);
      expect(() => findCell(notebook, { index: 0 })).toThrow();
    });

    test('throws error for non-existent id', () => {
      const notebook = createNotebook('python3', 'python', Template.BASIC);
      expect(() => findCell(notebook, { id: 'non-existent' })).toThrow();
    });
  });

  describe('updateCell', () => {
    test('updates cell source', () => {
      const notebook = createNotebook('python3', 'python', Template.BASIC);
      updateCell(notebook, { index: 0 }, 'x = 1');
      expect(getCellSource(notebook.cells[0])).toBe('x = 1');
    });

    test('appends to cell source', () => {
      const notebook = createNotebook('python3', 'python', Template.BASIC);
      updateCell(notebook, { index: 0 }, 'x = 1');
      updateCell(notebook, { index: 0 }, undefined, '\ny = 2');
      expect(getCellSource(notebook.cells[0])).toBe('x = 1\ny = 2');
    });

    test('changes cell type', () => {
      const notebook = createNotebook('python3', 'python', Template.BASIC);
      updateCell(notebook, { index: 0 }, '# Title', undefined, CellType.MARKDOWN);
      expect(notebook.cells[0].cell_type).toBe('markdown');
      expect(getCellSource(notebook.cells[0])).toBe('# Title');
    });

    test('clears outputs when updating code cell', () => {
      const notebook = createNotebook('python3', 'python', Template.BASIC);
      const cell: any = notebook.cells[0];
      cell.execution_count = 1;
      cell.outputs = [{ output_type: 'stream', name: 'stdout', text: 'output' }];

      updateCell(notebook, { index: 0 }, 'x = 2');
      expect(cell.execution_count).toBeNull();
      expect(cell.outputs).toHaveLength(0);
    });
  });

  describe('deleteCell', () => {
    test('deletes cell by index', () => {
      const notebook = createNotebook('python3', 'python', Template.BASIC);
      addCell(notebook, 'x = 1');
      deleteCell(notebook, { index: 0 });
      expect(notebook.cells).toHaveLength(1);
    });

    test('deletes cell by id', () => {
      const notebook = createNotebook('python3', 'python', Template.BASIC);
      const cellId = notebook.cells[0].id;
      deleteCell(notebook, { id: cellId });
      expect(notebook.cells).toHaveLength(0);
    });
  });

  describe('clearOutputs', () => {
    test('clears all outputs', () => {
      const notebook = createNotebook('python3', 'python', Template.BASIC);
      const cell: any = notebook.cells[0];
      cell.execution_count = 1;
      cell.outputs = [{ output_type: 'stream', name: 'stdout', text: 'output' }];

      clearOutputs(notebook);
      expect(cell.execution_count).toBeNull();
      expect(cell.outputs).toHaveLength(0);
    });

    test('clears specific cell outputs', () => {
      const notebook = createNotebook('python3', 'python', Template.BASIC);
      addCell(notebook, 'x = 1');

      const cell1: any = notebook.cells[0];
      const cell2: any = notebook.cells[1];

      cell1.execution_count = 1;
      cell1.outputs = [{ output_type: 'stream', name: 'stdout', text: 'output1' }];
      cell2.execution_count = 2;
      cell2.outputs = [{ output_type: 'stream', name: 'stdout', text: 'output2' }];

      clearOutputs(notebook, { index: 0 });
      expect(cell1.outputs).toHaveLength(0);
      expect(cell2.outputs).toHaveLength(1);
    });
  });

  describe('searchCells', () => {
    test('finds cells matching pattern', () => {
      const notebook = createNotebook('python3', 'python', Template.EMPTY);
      addCell(notebook, 'import pandas');
      addCell(notebook, 'import numpy');
      addCell(notebook, 'x = 1');

      const results = searchCells(notebook, 'import');
      expect(results).toHaveLength(2);
    });

    test('finds cells with errors', () => {
      const notebook = createNotebook('python3', 'python', Template.EMPTY);
      addCell(notebook, 'x = 1');
      addCell(notebook, 'y = 2');

      const cell: any = notebook.cells[0];
      cell.outputs = [
        { output_type: 'error', ename: 'ValueError', evalue: 'test error', traceback: [] },
      ];

      const results = searchCells(notebook, undefined, true);
      expect(results).toHaveLength(1);
      expect(results[0].index).toBe(0);
    });

    test('returns all cells when no filter', () => {
      const notebook = createNotebook('python3', 'python', Template.BASIC);
      addCell(notebook, 'x = 1');

      const results = searchCells(notebook);
      expect(results).toHaveLength(2);
    });
  });

  describe('getCellSource', () => {
    test('gets source from string', () => {
      const cell = createCell(CellType.CODE, 'x = 1');
      expect(getCellSource(cell)).toBe('x = 1');
    });

    test('gets source from array', () => {
      const cell = createCell(CellType.CODE, 'x = 1');
      cell.source = ['x = 1', '\n', 'y = 2'];
      expect(getCellSource(cell)).toBe('x = 1\ny = 2');
    });
  });
});
