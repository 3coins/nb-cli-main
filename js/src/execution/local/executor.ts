import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { ExecutionResult, ExecutorConfig } from '../types.js';
import { discoverPython, checkNbclient } from './discovery.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = join(__dirname, '../../../scripts/execute_notebook.py');

export class LocalExecutor {
  private pythonPath: string | null = null;
  private config: ExecutorConfig;

  constructor(config: ExecutorConfig = {}) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Discover Python if not provided
    if (this.config.pythonPath) {
      this.pythonPath = this.config.pythonPath;
    } else {
      this.pythonPath = await discoverPython();
    }

    if (!this.pythonPath) {
      throw new Error(
        'Python not found. Please install Python 3 and ensure it is in your PATH.'
      );
    }

    // Check if nbclient is available
    const hasNbclient = await checkNbclient(this.pythonPath);
    if (!hasNbclient) {
      throw new Error(
        'nbclient not found. Install with: pip install nbclient nbformat'
      );
    }
  }

  async executeCell(
    notebookPath: string,
    cellIndex: number,
    timeout: number = 60
  ): Promise<ExecutionResult> {
    if (!this.pythonPath) {
      await this.initialize();
    }

    try {
      const args = [
        SCRIPT_PATH,
        notebookPath,
        '--cell-index',
        cellIndex.toString(),
        '--timeout',
        timeout.toString(),
      ];

      const proc = Bun.spawn([this.pythonPath!, ...args], {
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const output = await new Response(proc.stdout).text();
      await proc.exited;

      if (proc.exitCode !== 0) {
        const error = await new Response(proc.stderr).text();
        return {
          success: false,
          outputs: [],
          error: error || 'Execution failed',
        };
      }

      const result = JSON.parse(output);

      if (result.error) {
        return {
          success: false,
          outputs: [],
          error: result.error,
        };
      }

      return {
        success: true,
        outputs: result.outputs || [],
        execution_count: result.execution_count,
      };
    } catch (error) {
      return {
        success: false,
        outputs: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async executeNotebook(notebookPath: string, timeout: number = 600): Promise<ExecutionResult> {
    if (!this.pythonPath) {
      await this.initialize();
    }

    try {
      const args = [SCRIPT_PATH, notebookPath, '--timeout', timeout.toString()];

      const proc = Bun.spawn([this.pythonPath!, ...args], {
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const output = await new Response(proc.stdout).text();
      await proc.exited;

      if (proc.exitCode !== 0) {
        const error = await new Response(proc.stderr).text();
        return {
          success: false,
          outputs: [],
          error: error || 'Execution failed',
        };
      }

      const result = JSON.parse(output);

      if (result.error) {
        return {
          success: false,
          outputs: [],
          error: result.error,
        };
      }

      return {
        success: true,
        outputs: [],
      };
    } catch (error) {
      return {
        success: false,
        outputs: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
