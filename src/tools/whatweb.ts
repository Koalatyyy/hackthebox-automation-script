import { wsl, toWslPath } from './wsl';
import * as path from 'path';
import type { Port } from '../types';

export async function whatweb(target: string, port: Port, outDir: string): Promise<void> {
  const outFile = path.join(outDir, `whatweb-${port.number}.txt`);
  const scheme = port.service === 'https' || port.number === 443 ? 'https' : 'http';
  const url = `${scheme}://${target}:${port.number}`;

  console.log(`\n[whatweb] Fingerprinting ${url}...`);

  await wsl(
    ['whatweb', '-v', '-a', '3', url, '--log-brief', toWslPath(outFile)],
    (chunk) => process.stdout.write(chunk)
  );
}
