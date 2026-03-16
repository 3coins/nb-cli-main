import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { readNotebook, writeNotebook, writeNotebookAtomic } from './io.js';
import { createNotebook } from './operations.js';
import { Template } from './types.js';

const TEST_DIR = join(import.meta.dir, '../../tests/temp');

describe('Notebook IO', () => {
  beforeEach(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('writeNotebook', () => {
    test('writes notebook to file', async () => {
      const notebook = createNotebook('python3', 'python', Template.BASIC);
      const path = join(TEST_DIR, 'test.ipynb');

      await writeNotebook(path, notebook);

      expect(existsSync(path)).toBe(true);
    });

    test('throws error for invalid notebook', async () => {
      const invalidNotebook: any = { cells: 'invalid' };
      const path = join(TEST_DIR, 'invalid.ipynb');

      await expect(writeNotebook(path, invalidNotebook)).rejects.toThrow();
    });
  });

  describe('readNotebook', () => {
    test('reads existing notebook', async () => {
      const notebook = createNotebook('python3', 'python', Template.BASIC);
      const path = join(TEST_DIR, 'test.ipynb');

      await writeNotebook(path, notebook);
      const read = await readNotebook(path);

      expect(read.cells).toHaveLength(1);
      expect(read.nbformat).toBe(4);
    });

    test('throws error for non-existent file', async () => {
      const path = join(TEST_DIR, 'nonexistent.ipynb');

      await expect(readNotebook(path)).rejects.toThrow();
    });

    test('throws error for invalid JSON', async () => {
      const path = join(TEST_DIR, 'invalid.ipynb');
      await Bun.write(path, 'not json');

      await expect(readNotebook(path)).rejects.toThrow();
    });

    test('throws error for invalid notebook format', async () => {
      const path = join(TEST_DIR, 'invalid.ipynb');
      await Bun.write(path, JSON.stringify({ invalid: true }));

      await expect(readNotebook(path)).rejects.toThrow();
    });
  });

  describe('writeNotebookAtomic', () => {
    test('writes notebook atomically', async () => {
      const notebook = createNotebook('python3', 'python', Template.BASIC);
      const path = join(TEST_DIR, 'atomic.ipynb');

      await writeNotebookAtomic(path, notebook);

      expect(existsSync(path)).toBe(true);
      const read = await readNotebook(path);
      expect(read.cells).toHaveLength(1);
    });

    test('cleans up temp file on error', async () => {
      const invalidNotebook: any = { cells: 'invalid' };
      const path = join(TEST_DIR, 'atomic-error.ipynb');
      const tempPath = `${path}.tmp`;

      await expect(writeNotebookAtomic(path, invalidNotebook)).rejects.toThrow();

      // Temp file should be cleaned up
      expect(existsSync(tempPath)).toBe(false);
    });
  });

  describe('round-trip', () => {
    test('preserves notebook structure', async () => {
      const original = createNotebook('python3', 'python', Template.MARKDOWN);
      const path = join(TEST_DIR, 'roundtrip.ipynb');

      await writeNotebook(path, original);
      const read = await readNotebook(path);

      expect(read.cells).toHaveLength(original.cells.length);
      expect(read.nbformat).toBe(original.nbformat);
      expect(read.nbformat_minor).toBe(original.nbformat_minor);
      expect(read.metadata.kernelspec?.name).toBe(original.metadata.kernelspec?.name);
    });
  });
});
