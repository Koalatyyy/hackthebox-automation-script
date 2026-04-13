import { wsl, toWslPath } from './wsl';
import * as path from 'path';
import type { Port } from '../types';

export async function nikto(target: string, port: Port, outDir: string, vhost?: string): Promise<void> {
  const outFile = path.join(outDir, `nikto-${port.number}.txt`);
  const ssl = port.service === 'https' || port.number === 443;

  console.log(`\n[nikto] Scanning ${target}:${port.number}${ssl ? ' (SSL)' : ''}${vhost ? ` (vhost: ${vhost})` : ''}...`);

  const args = ['nikto', '-h', target, '-p', String(port.number), '-output', toWslPath(outFile)];
  if (ssl) args.push('-ssl');
  if (vhost) args.push('-vhost', vhost);

  await wsl(args, (chunk) => process.stdout.write(chunk));
}
