import * as fs from 'fs';
import * as path from 'path';
import { wsl } from './wsl';
import type { Port } from '../types';

interface SploitEntry {
  Title: string;
  Path: string;
}

interface SearchsploitResult {
  query: string;
  port: number;
  service: string;
  exploits: SploitEntry[];
  shellcodes: SploitEntry[];
}

function buildQuery(port: Port): string | null {
  if (port.product) {
    return port.version ? `${port.product} ${port.version}` : port.product;
  }
  if (port.service && port.service !== 'unknown') {
    return port.service;
  }
  return null;
}

export async function searchsploit(ports: Port[], outDir: string): Promise<void> {
  const queryable = ports
    .map((p) => ({ port: p, query: buildQuery(p) }))
    .filter((x): x is { port: Port; query: string } => x.query !== null);

  if (queryable.length === 0) {
    console.log('\n[searchsploit] No versioned services to query.');
    return;
  }

  console.log(`\n[searchsploit] Querying ${queryable.length} service(s)...`);

  const results: SearchsploitResult[] = [];

  for (const { port, query } of queryable) {
    const { stdout, exitCode } = await wsl(['searchsploit', '--json', query]);
    if (exitCode !== 0 || !stdout.trim()) continue;

    let parsed: { EXPLOITS?: SploitEntry[]; Shellcodes?: SploitEntry[] };
    try {
      parsed = JSON.parse(stdout);
    } catch {
      continue;
    }

    const exploits = parsed.EXPLOITS ?? [];
    const shellcodes = parsed.Shellcodes ?? [];

    if (exploits.length > 0 || shellcodes.length > 0) {
      console.log(`  [+] ${query} (port ${port.number}): ${exploits.length} exploit(s), ${shellcodes.length} shellcode(s)`);
    } else {
      console.log(`  [-] ${query} (port ${port.number}): no results`);
    }

    results.push({ query, port: port.number, service: port.service, exploits, shellcodes });
  }

  const outFile = path.join(outDir, 'searchsploit.json');
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2), 'utf8');
}
