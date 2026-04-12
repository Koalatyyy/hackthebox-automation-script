import { wsl, toWslPath } from './wsl';
import * as path from 'path';
import type { Port } from '../types';

export async function sqlmap(target: string, port: Port, outDir: string): Promise<void> {
  const scheme = port.service === 'https' || port.number === 443 ? 'https' : 'http';
  const url = `${scheme}://${target}:${port.number}`;
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
