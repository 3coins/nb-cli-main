import { Command } from 'commander';
import { createCommand } from './commands/create.js';
import { readCommand } from './commands/read.js';
import { searchCommand } from './commands/search.js';
import { cellCommand } from './commands/cell.js';
import { outputCommand } from './commands/output.js';
import { connectCommand } from './commands/connect.js';
import { statusCommand } from './commands/status.js';
import { disconnectCommand } from './commands/disconnect.js';
import { executeCommand } from './commands/execute.js';
import { selfCommand } from './commands/self.js';

export function createCLI(): Command {
  const program = new Command();

  program
    .name('nb')
    .description('CLI tool for working with Jupyter notebooks')
    .version('0.0.1')
    .allowExcessArguments(false);

  // Register commands
  program.addCommand(createCommand());
  program.addCommand(readCommand());
  program.addCommand(executeCommand());
  program.addCommand(searchCommand());
  program.addCommand(cellCommand());
  program.addCommand(outputCommand());
  program.addCommand(connectCommand());
  program.addCommand(statusCommand());
  program.addCommand(disconnectCommand());
  program.addCommand(selfCommand());

  return program;
}
