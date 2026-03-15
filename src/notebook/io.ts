import { validateNotebookContent } from '@jupyterlab/nbformat';
import type { Notebook } from './types.js';

/**
 * Read a Jupyter notebook from a file
 */
export async function readNotebook(path: string): Promise<Notebook> {
  try {
    const file = Bun.file(path);
    const content = await file.text();
    const notebook = JSON.parse(content);

    // Validate notebook format
    const errors = validateNotebookContent(notebook);
    if (errors.length > 0) {
      throw new Error(`Invalid notebook format: ${errors.join(', ')}`);
    }

    return notebook as Notebook;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('No such file')) {
        throw new Error(`Failed to read notebook file: ${path}`);
      }
      throw error;
    }
    throw new Error(`Failed to read notebook: ${error}`);
  }
}

/**
 * Write a Jupyter notebook to a file
 */
export async function writeNotebook(path: string, notebook: Notebook): Promise<void> {
  try {
    // Validate notebook before writing
    const errors = validateNotebookContent(notebook);
    if (errors.length > 0) {
      throw new Error(`Invalid notebook format: ${errors.join(', ')}`);
    }

    const content = JSON.stringify(notebook, null, 2) + '\n';
    await Bun.write(path, content);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to write notebook: ${error}`);
  }
}

/**
 * Write a Jupyter notebook to a file atomically using a temporary file
 * This prevents corruption if the write operation is interrupted
 */
export async function writeNotebookAtomic(path: string, notebook: Notebook): Promise<void> {
  const tempPath = `${path}.tmp`;

  try {
    // Write to temporary file first
    await writeNotebook(tempPath, notebook);

    // Atomically rename temporary file to target file
    await Bun.write(path, Bun.file(tempPath));
    await Bun.spawn(['rm', tempPath]).exited;
  } catch (error) {
    // Clean up temp file if it exists
    try {
      await Bun.spawn(['rm', '-f', tempPath]).exited;
    } catch {
      // Ignore cleanup errors
    }

    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to write notebook atomically: ${error}`);
  }
}
