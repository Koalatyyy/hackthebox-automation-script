import { wsl, toWslPath } from './wsl';
import * as path from 'path';
import type { Port } from '../types';

export async function whatweb(target: string, port: Port, outDir: string, hostname?: string): Promise<void> {
  const outFile = path.join(outDir, `whatweb-${port.number}.txt`);
  const scheme = port.service === 'https' || port.number === 443 ? 'https' : 'http';
  const host = hostname ?? target;
  const isStandardPort = (scheme === 'http' && port.number === 80) || (scheme === 'https' && port.number === 443);
  const url = isStandardPort ? `${scheme}://${host}` : `${scheme}://${host}:${port.number}`;

  console.log(`\n[whatweb] Fingerprinting ${url}...`);

  const result = await wsl(
    ['whatweb', '-v', '-a', '3', url, '--log-brief', toWslPath(outFile)],
    (chunk) => process.stdout.write(chunk)
  );
  if (result.exitCode === 127) {
    console.warn('[whatweb] Skipped: whatweb not found in PATH. Install with: sudo apt install whatweb');
  }
}
