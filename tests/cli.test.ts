import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { $ } from 'bun';

const TEST_DIR = join(import.meta.dir, 'temp');
const CLI_PATH = join(import.meta.dir, '../src/index.ts');

describe('CLI Integration Tests', () => {
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

  describe('create command', () => {
    test('creates empty notebook', async () => {
      const path = join(TEST_DIR, 'empty.ipynb');
      const result =
        await $`bun run ${CLI_PATH} create ${path} -t empty -f json`.quiet().text();

      const output = JSON.parse(result);
      expect(output.file).toBe(path);
      expect(output.template).toBe('empty');
      expect(output.cell_count).toBe(0);
      expect(existsSync(path)).toBe(true);
    });

    test('creates basic notebook', async () => {
      const path = join(TEST_DIR, 'basic.ipynb');
      const result =
        await $`bun run ${CLI_PATH} create ${path} -t basic -f json`.quiet().text();

      const output = JSON.parse(result);
      expect(output.cell_count).toBe(1);
    });

    test('creates markdown template', async () => {
      const path = join(TEST_DIR, 'markdown.ipynb');
      const result =
        await $`bun run ${CLI_PATH} create ${path} -t markdown -f json`.quiet().text();

      const output = JSON.parse(result);
      expect(output.cell_count).toBe(2);
    });

    test('fails when file exists without force', async () => {
      const path = join(TEST_DIR, 'exists.ipynb');
      await $`bun run ${CLI_PATH} create ${path}`.quiet();

      const proc = Bun.spawn(['bun', 'run', CLI_PATH, 'create', path], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      await proc.exited;

      expect(proc.exitCode).not.toBe(0);
    });

    test('overwrites with force flag', async () => {
      const path = join(TEST_DIR, 'force.ipynb');
      await $`bun run ${CLI_PATH} create ${path} -t empty`.quiet();
      await $`bun run ${CLI_PATH} create ${path} -t basic --force`.quiet();

      const result = await $`bun run ${CLI_PATH} read ${path} -f json`.quiet().text();
      const output = JSON.parse(result);
      expect(output.cells).toHaveLength(1);
    });
  });

  describe('read command', () => {
    test('reads notebook', async () => {
      const path = join(TEST_DIR, 'read.ipynb');
      await $`bun run ${CLI_PATH} create ${path} -t basic`.quiet();

      const result = await $`bun run ${CLI_PATH} read ${path} -f json`.quiet().text();
      const output = JSON.parse(result);

      expect(output.cells).toBeDefined();
      expect(output.cells).toHaveLength(1);
      expect(output.metadata).toBeDefined();
    });

    test('reads specific cell by index', async () => {
      const path = join(TEST_DIR, 'read-cell.ipynb');
      await $`bun run ${CLI_PATH} create ${path} -t basic`.quiet();

      const result =
        await $`bun run ${CLI_PATH} read ${path} -i 0 -f json`.quiet().text();
      const output = JSON.parse(result);

      expect(output.index).toBe(0);
      expect(output.cell_type).toBe('code');
    });

    test('reads only code cells', async () => {
      const path = join(TEST_DIR, 'read-code.ipynb');
      await $`bun run ${CLI_PATH} create ${path} -t markdown`.quiet();

      const result =
        await $`bun run ${CLI_PATH} read ${path} --only-code -f json`.quiet().text();
      const output = JSON.parse(result);

      expect(output.cells).toHaveLength(1);
      expect(output.cells[0].cell_type).toBe('code');
    });
  });

  describe('cell add command', () => {
    test('adds code cell', async () => {
      const path = join(TEST_DIR, 'add.ipynb');
      await $`bun run ${CLI_PATH} create ${path} -t empty`.quiet();
      await $`bun run ${CLI_PATH} cell add ${path} -s "print('hello')"`.quiet();

      const result = await $`bun run ${CLI_PATH} read ${path} -f json`.quiet().text();
      const output = JSON.parse(result);

      expect(output.cells).toHaveLength(1);
      expect(output.cells[0].source).toContain('hello');
    });

    test('adds markdown cell', async () => {
      const path = join(TEST_DIR, 'add-md.ipynb');
      await $`bun run ${CLI_PATH} create ${path} -t empty`.quiet();
      await $`bun run ${CLI_PATH} cell add ${path} -s "# Title" -t markdown`.quiet();

      const result = await $`bun run ${CLI_PATH} read ${path} -f json`.quiet().text();
      const output = JSON.parse(result);

      expect(output.cells[0].cell_type).toBe('markdown');
    });

    test('adds cell at specific index', async () => {
      const path = join(TEST_DIR, 'add-index.ipynb');
      await $`bun run ${CLI_PATH} create ${path} -t basic`.quiet();
      await $`bun run ${CLI_PATH} cell add ${path} -s "x = 1" -i 0`.quiet();

      const result = await $`bun run ${CLI_PATH} read ${path} -f json`.quiet().text();
      const output = JSON.parse(result);

      expect(output.cells).toHaveLength(2);
      expect(output.cells[0].source).toContain('x = 1');
    });
  });

  describe('cell update command', () => {
    test('updates cell source', async () => {
      const path = join(TEST_DIR, 'update.ipynb');
      await $`bun run ${CLI_PATH} create ${path} -t basic`.quiet();
      await $`bun run ${CLI_PATH} cell update ${path} --cell-index 0 -s "x = 1"`.quiet();

      const result = await $`bun run ${CLI_PATH} read ${path} -f json`.quiet().text();
      const output = JSON.parse(result);

      expect(output.cells[0].source).toContain('x = 1');
    });

    test('appends to cell', async () => {
      const path = join(TEST_DIR, 'append.ipynb');
      await $`bun run ${CLI_PATH} create ${path} -t basic`.quiet();
      await $`bun run ${CLI_PATH} cell update ${path} --cell-index 0 -s "x = 1"`.quiet();
      await $`bun run ${CLI_PATH} cell update ${path} --cell-index 0 --append "\\ny = 2"`.quiet();

      const result = await $`bun run ${CLI_PATH} read ${path} -f json`.quiet().text();
      const output = JSON.parse(result);

      expect(output.cells[0].source).toContain('x = 1');
      expect(output.cells[0].source).toContain('y = 2');
    });
  });

  describe('cell delete command', () => {
    test('deletes cell', async () => {
      const path = join(TEST_DIR, 'delete.ipynb');
      await $`bun run ${CLI_PATH} create ${path} -t markdown`.quiet();
      await $`bun run ${CLI_PATH} cell delete ${path} --cell-index 0`.quiet();

      const result = await $`bun run ${CLI_PATH} read ${path} -f json`.quiet().text();
      const output = JSON.parse(result);

      expect(output.cells).toHaveLength(1);
    });
  });

  describe('search command', () => {
    test('searches for pattern', async () => {
      const path = join(TEST_DIR, 'search.ipynb');
      await $`bun run ${CLI_PATH} create ${path} -t empty`.quiet();
      await $`bun run ${CLI_PATH} cell add ${path} -s "import pandas"`.quiet();
      await $`bun run ${CLI_PATH} cell add ${path} -s "import numpy"`.quiet();
      await $`bun run ${CLI_PATH} cell add ${path} -s "x = 1"`.quiet();

      const result =
        await $`bun run ${CLI_PATH} search ${path} import -f json`.quiet().text();
      const output = JSON.parse(result);

      expect(output.matches).toBe(2);
    });
  });

  describe('output clear command', () => {
    test('clears outputs', async () => {
      const path = join(TEST_DIR, 'clear.ipynb');
      await $`bun run ${CLI_PATH} create ${path} -t basic`.quiet();

      const result =
        await $`bun run ${CLI_PATH} output clear ${path} -f json`.quiet().text();
      const output = JSON.parse(result);

      expect(output.action).toBe('cleared_outputs');
    });
  });

  describe('status command', () => {
    test('shows not connected status', async () => {
      const result = await $`bun run ${CLI_PATH} status -f json`.quiet().text();
      const output = JSON.parse(result);

      expect(output.connected).toBe(false);
    });
  });

  describe('self version command', () => {
    test('shows version info', async () => {
      const result = await $`bun run ${CLI_PATH} self version -f json`.quiet().text();
      const output = JSON.parse(result);

      expect(output.version).toBeDefined();
      expect(output.runtime).toBe('bun');
    });
  });
});
