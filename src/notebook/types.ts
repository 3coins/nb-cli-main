import type { INotebookContent, ICell } from '@jupyterlab/nbformat';

export type Notebook = INotebookContent;
export type Cell = ICell;

export interface CellReference {
  index?: number;
  id?: string;
}

export enum OutputFormat {
  JSON = 'json',
  TEXT = 'text',
}

export enum CellType {
  CODE = 'code',
  MARKDOWN = 'markdown',
  RAW = 'raw',
}

export enum Template {
  EMPTY = 'empty',
  BASIC = 'basic',
  MARKDOWN = 'markdown',
}
