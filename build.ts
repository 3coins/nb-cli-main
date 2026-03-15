#!/usr/bin/env bun
import { $ } from 'bun';

// Simple build script that makes the index executable
const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  target: 'bun',
  format: 'esm',
  sourcemap: 'external',
  external: ['*'], // Mark all imports as external to avoid bundling node_modules
});

if (!result.success) {
  console.error('Build failed');
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

// Make the output executable
await $`chmod +x dist/index.js`;

console.log('Build successful!');
