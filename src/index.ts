#!/usr/bin/env bun
import { createCLI } from './cli.js';

async function main() {
  const program = createCLI();

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error(`Error: ${error}`);
    }
    process.exit(1);
  }
}

main();
