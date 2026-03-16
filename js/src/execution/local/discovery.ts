/**
 * Discover Python interpreter
 */
export async function discoverPython(): Promise<string | null> {
  const candidates = ['python3', 'python'];

  for (const candidate of candidates) {
    try {
      const proc = Bun.spawn([candidate, '--version'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      await proc.exited;

      if (proc.exitCode === 0) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Check if nbclient is available
 */
export async function checkNbclient(pythonPath: string): Promise<boolean> {
  try {
    const proc = Bun.spawn([pythonPath, '-c', 'import nbclient'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await proc.exited;

    return proc.exitCode === 0;
  } catch {
    return false;
  }
}
