import { Command } from 'commander';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { createNotebook } from '../notebook/operations.js';
import { writeNotebookAtomic } from '../notebook/io.js';
import { OutputFormat, Template } from '../notebook/types.js';

interface CreateOptions {
  kernel: string;
  language: string;
  template: string;
  force: boolean;
  format: string;
}

export function createCommand(): Command {
  const cmd = new Command('create');

  cmd
    .description('Create a new notebook file')
    .argument('<file>', 'Path to create notebook file')
    .option('-k, --kernel <name>', 'Kernel name', 'python3')
    .option('--language <lang>', 'Kernel language', 'python')
    .option('-t, --template <type>', 'Template type (empty|basic|markdown)', 'empty')
    .option('--force', 'Overwrite if file exists', false)
    .option('-f, --format <format>', 'Output format (json|text)', 'json')
    .action(async (file: string, options: CreateOptions) => {
      await executeCreate(file, options);
    });

  return cmd;
}

async function executeCreate(file: string, options: CreateOptions): Promise<void> {
  // Ensure path ends with .ipynb
  const path = file.endsWith('.ipynb') ? file : `${file}.ipynb`;

  // Check if file exists
  if (existsSync(path) && !options.force) {
    throw new Error(`File '${path}' already exists. Use --force to overwrite.`);
  }

  // Create parent directories if they don't exist
  const parentDir = dirname(path);
  if (parentDir && !existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }

  // Parse template
  const template = parseTemplate(options.template);
  const format = parseFormat(options.format);

  // Create notebook
  const notebook = createNotebook(options.kernel, options.language, template);

  // Write notebook to file
  await writeNotebookAtomic(path, notebook);

  // Output result
  const result = {
    file: path,
    template: options.template,
    kernel: options.kernel,
    cell_count: notebook.cells.length,
  };

  if (format === OutputFormat.JSON) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Created notebook: ${result.file}`);
    console.log(`Template: ${result.template}`);
    console.log(`Kernel: ${result.kernel}`);
    console.log(`Cells: ${result.cell_count}`);
  }
}

function parseTemplate(templateStr: string): Template {
  const lower = templateStr.toLowerCase();
  switch (lower) {
    case 'empty':
      return Template.EMPTY;
    case 'basic':
      return Template.BASIC;
    case 'markdown':
      return Template.MARKDOWN;
    default:
      throw new Error(`Unknown template: ${templateStr}. Use empty, basic, or markdown.`);
  }
}

function parseFormat(formatStr: string): OutputFormat {
  const lower = formatStr.toLowerCase();
  switch (lower) {
    case 'json':
      return OutputFormat.JSON;
    case 'text':
      return OutputFormat.TEXT;
    default:
      throw new Error(`Unknown format: ${formatStr}. Use json or text.`);
  }
}
