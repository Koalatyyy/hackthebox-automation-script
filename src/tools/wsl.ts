import { spawn } from 'child_process';

const IS_WINDOWS = process.platform === 'win32';
const REMOTE_HOST = process.env.REMOTE_HOST; // e.g. "pi@raspberrypi"

export function toWslPath(winPath: string): string {
  if (!IS_WINDOWS) return winPath;
  return winPath
    .replace(/\\/g, '/')
    .replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`);
}

export interface WslResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function spawnArgs(args: string[]): { cmd: string; cmdArgs: string[]; opts: object } {
  if (REMOTE_HOST) {
    return { cmd: 'ssh', cmdArgs: [REMOTE_HOST, '--', ...args], opts: {} };
  }
  if (IS_WINDOWS) {
    return { cmd: 'wsl.exe', cmdArgs: ['--', ...args], opts: { windowsHide: true } };
  }
  return { cmd: args[0], cmdArgs: args.slice(1), opts: {} };
}

export function startSocksProxy(port = 1080): void {
  if (!REMOTE_HOST) return;
  const proc = spawn('ssh', ['-D', String(port), '-N', '-o', 'ExitOnForwardFailure=yes', REMOTE_HOST], {
    detached: true,
    stdio: 'ignore',
  });
  proc.unref();
  console.log(`[proxy] SOCKS5 proxy started on 127.0.0.1:${port} via ${REMOTE_HOST}`);
}

export function wslDetached(args: string[]): void {
  if (REMOTE_HOST) {
    // Run in background on remote via ssh -f
    const proc = spawn('ssh', ['-f', '-n', REMOTE_HOST, '--', ...args], { stdio: 'ignore' });
    proc.unref();
    return;
  }
  const { cmd, cmdArgs, opts } = spawnArgs(args);
  const proc = spawn(cmd, cmdArgs, {
    ...opts,
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
    const { cmd, cmdArgs, opts } = spawnArgs(args);
    const proc = spawn(cmd, cmdArgs, opts);
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
    proc.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        resolve({ stdout: '', stderr: `tool not found: ${args[0]}`, exitCode: 127 });
      } else {
        reject(err);
      }
    });
  });
}
