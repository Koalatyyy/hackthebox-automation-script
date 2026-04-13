import { wsl, toWslPath } from './wsl';
import * as path from 'path';
import type { Port } from '../types';

export async function sqlmap(target: string, port: Port, outDir: string, hostname?: string): Promise<void> {
  const scheme = port.service === 'https' || port.number === 443 ? 'https' : 'http';
  const host = hostname ?? target;
  const isStandardPort = (scheme === 'http' && port.number === 80) || (scheme === 'https' && port.number === 443);
  const url = isStandardPort ? `${scheme}://${host}` : `${scheme}://${host}:${port.number}`;
  const sqlmapOutDir = path.join(outDir, `sqlmap-${port.number}`);

  console.log(`\n[sqlmap] Crawling ${url} for SQLi...`);

  await wsl(
    [
      'sqlmap',
      '-u', url,
      '--batch',
      '--crawl=2',
      '--level=2',
      '--risk=1',
      '--output-dir', toWslPath(sqlmapOutDir),
    ],
    (chunk) => process.stdout.write(chunk)
  );
}
