import { homedir } from 'os';
import { join } from 'path';
import { readdirSync, readFileSync, existsSync } from 'fs';

export interface JupyterServer {
  url: string;
  token: string;
  notebook_dir?: string;
  pid?: number;
}

/**
 * Discover running Jupyter servers by reading runtime files
 */
export async function discoverServers(): Promise<JupyterServer[]> {
  const servers: JupyterServer[] = [];
  const runtimeDir = join(homedir(), '.local', 'share', 'jupyter', 'runtime');

  if (!existsSync(runtimeDir)) {
    return servers;
  }

  try {
    const files = readdirSync(runtimeDir);

    for (const file of files) {
      if (file.startsWith('jpserver-') && file.endsWith('.json')) {
        try {
          const filePath = join(runtimeDir, file);
          const content = readFileSync(filePath, 'utf-8');
          const data = JSON.parse(content);

          if (data.url && data.token) {
            servers.push({
              url: data.url,
              token: data.token,
              notebook_dir: data.notebook_dir,
              pid: data.pid,
            });
          }
        } catch (error) {
          // Skip invalid files
          continue;
        }
      }
    }
  } catch (error) {
    // Return empty list if directory can't be read
    return servers;
  }

  return servers;
}

/**
 * Validate a Jupyter server by making a request to the API
 */
export async function validateServer(url: string, token: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/api`, {
      headers: {
        Authorization: `token ${token}`,
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get server info
 */
export async function getServerInfo(url: string, token: string): Promise<any> {
  try {
    const response = await fetch(`${url}/api`, {
      headers: {
        Authorization: `token ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Failed to get server info: ${error}`);
  }
}
