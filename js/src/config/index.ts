import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

export interface ConnectionConfig {
  server: string;
  token: string;
  connected_at: string;
}

const CONFIG_DIR = '.jupyter';
const CONFIG_FILE = 'cli.json';

/**
 * Get the config directory path (relative to current working directory)
 */
export function getConfigDir(): string {
  return join(process.cwd(), CONFIG_DIR);
}

/**
 * Get the config file path
 */
export function getConfigPath(): string {
  return join(getConfigDir(), CONFIG_FILE);
}

/**
 * Ensure the config directory exists
 */
export function ensureConfigDir(): void {
  const dir = getConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Read connection config
 */
export async function readConfig(): Promise<ConnectionConfig | null> {
  try {
    const path = getConfigPath();
    const file = Bun.file(path);
    if (!(await file.exists())) {
      return null;
    }
    const content = await file.text();
    return JSON.parse(content) as ConnectionConfig;
  } catch (error) {
    return null;
  }
}

/**
 * Write connection config
 */
export async function writeConfig(config: ConnectionConfig): Promise<void> {
  ensureConfigDir();
  const path = getConfigPath();
  const content = JSON.stringify(config, null, 2) + '\n';
  await Bun.write(path, content);
}

/**
 * Delete connection config
 */
export async function deleteConfig(): Promise<void> {
  try {
    const path = getConfigPath();
    await Bun.spawn(['rm', '-f', path]).exited;
  } catch {
    // Ignore errors if file doesn't exist
  }
}

/**
 * Check if connected
 */
export async function isConnected(): Promise<boolean> {
  const config = await readConfig();
  return config !== null;
}
