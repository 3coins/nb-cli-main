import type { IOutput } from '@jupyterlab/nbformat';

export interface ExecutionResult {
  success: boolean;
  outputs: IOutput[];
  execution_count?: number;
  error?: string;
}

export interface ExecutionOptions {
  timeout?: number;
  kernel?: string;
}

export interface ExecutorConfig {
  pythonPath?: string;
  timeout?: number;
}
