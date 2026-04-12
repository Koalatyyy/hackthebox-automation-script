import { wsl, toWslPath } from './wsl';
import * as path from 'path';
import type { Port } from '../types';

const DEFAULT_WORDLIST = '/usr/share/seclists/Discovery/Web-Content/common.txt';

export async function gobuster(
  target: string,
  port: Port,
  outDir: string,
  wordlist = DEFAULT_WORDLIST
): Promise<void> {
  const outFile = path.join(outDir, `gobuster-${port.number}.txt`);
  const scheme = port.service === 'https' || port.number === 443 ? 'https' : 'http';
  const url = `${scheme}://${target}:${port.number}`;

  console.log(`\n[gobuster] Dir brute-force on ${url}...`);

  await wsl(
    ['gobuster', 'dir', '-u', url, '-w', wordlist, '-o', toWslPath(outFile), '-t', '50', '--no-error'],
    (chunk) => process.stdout.write(chunk)
  );
}
