import { spawn } from 'child_process';

export function toWslPath(winPath: string): string {
  return winPath
    .replace(/\\/g, '/')
    .replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`);
}

export interface WslResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function wslDetached(args: string[]): void {
  const proc = spawn('wsl.exe', ['--', ...args], {
    windowsHide: true,
    detached: true,
    stdio: 'ignore',
  });
  proc.unref();
}

export async function wsl(
  args: string[],
  onData?: (chunk: string) => void
): Promise<WslResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn('wsl.exe', ['--', ...args], { windowsHide: true });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      onData?.(text);
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      onData?.(text);
    });

    proc.on('close', (code) => resolve({ stdout, stderr, exitCode: code ?? 0 }));
    proc.on('error', reject);
  });
}
