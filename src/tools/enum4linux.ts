import * as fs from 'fs';
import * as path from 'path';
import { wsl } from './wsl';

export async function enum4linux(target: string, outDir: string): Promise<void> {
  const outFile = path.join(outDir, 'enum4linux.txt');

  console.log(`\n[enum4linux] SMB enumeration on ${target}...`);

  const { stdout, stderr } = await wsl(
    ['enum4linux', '-a', target],
    (chunk) => process.stdout.write(chunk)
  );

  fs.writeFileSync(outFile, stdout + stderr, 'utf8');
}
