import * as fs from 'fs';
import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { wsl, toWslPath } from './wsl';
import type { Port } from '../types';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ['host', 'port'].includes(name),
});

function parseNmapXml(xml: string): Port[] {
  const doc = xmlParser.parse(xml);
  const hosts: unknown[] = doc?.nmaprun?.host ?? [];
  const ports: Port[] = [];

  for (const host of hosts as Record<string, unknown>[]) {
    const hostPorts = (host?.ports as Record<string, unknown>)?.port as Record<string, unknown>[] | undefined;
    if (!hostPorts) continue;

    for (const p of hostPorts) {
      const state = (p?.state as Record<string, string>)?.['@_state'];
      if (state !== 'open') continue;

      const svc = p?.service as Record<string, string> | undefined;
      ports.push({
        number: parseInt(p['@_portid'] as string, 10),
        protocol: p['@_protocol'] as 'tcp' | 'udp',
        state: 'open',
        service: svc?.['@_name'] ?? 'unknown',
        product: svc?.['@_product'],
        version: svc?.['@_version'],
        extrainfo: svc?.['@_extrainfo'],
      });
    }
  }

  return ports;
}

async function runNmap(args: string[], outDir: string, outName: string): Promise<Port[]> {
  const xmlFile = path.join(outDir, `${outName}.xml`);

  const result = await wsl(
    ['nmap', ...args, '-oX', '-'],
    (chunk) => process.stderr.write(chunk)
  );

  const xml = result.stdout;
  if (!xml.includes('<nmaprun')) return [];

  fs.writeFileSync(xmlFile, xml);
  return parseNmapXml(xml);
}

export async function nmapQuick(target: string, outDir: string): Promise<Port[]> {
  console.log('\n[nmap] Quick scan (top 1000 ports)...');
  return runNmap(['-T4', '--open', target], outDir, 'nmap-quick');
}

export async function nmapFull(target: string, outDir: string): Promise<Port[]> {
  console.log('\n[nmap] Full port scan (0-65535)...');
  return runNmap(['-p-', '-T4', '--open', target], outDir, 'nmap-full');
}

export async function nmapServices(target: string, ports: Port[], outDir: string): Promise<Port[]> {
  if (ports.length === 0) return [];
  const portList = ports.map((p) => p.number).join(',');
  console.log(`\n[nmap] Service/script scan on: ${portList}`);
  return runNmap(['-sV', '-sC', '--open', '-p', portList, target], outDir, 'nmap-services');
}

export function mergePorts(a: Port[], b: Port[]): Port[] {
  const map = new Map<string, Port>();
  for (const p of [...a, ...b]) {
    const key = `${p.protocol}/${p.number}`;
    const existing = map.get(key);
    if (!existing || (p.service !== 'unknown' && existing.service === 'unknown') || (!existing.product && p.product)) {
      map.set(key, p);
    }
  }
  return [...map.values()].sort((x, y) => x.number - y.number);
}

export function extractVhosts(xml: string): string[] {
  const doc = xmlParser.parse(xml);
  const hosts: unknown[] = doc?.nmaprun?.host ?? [];
  const found = new Set<string>();

  for (const host of hosts as Record<string, unknown>[]) {
    const hostPorts = (host?.ports as Record<string, unknown>)?.port as Record<string, unknown>[] | undefined;
    if (!hostPorts) continue;
    for (const p of hostPorts) {
      const scripts = p?.script;
      const list = Array.isArray(scripts) ? scripts : scripts ? [scripts] : [];
      for (const s of list as Record<string, string>[]) {
        const output = s?.['@_output'] ?? '';
        const m = output.match(/https?:\/\/([a-zA-Z0-9][-a-zA-Z0-9.]*\.[a-zA-Z]{2,})/i);
        if (m && !/^\d+\.\d+\.\d+\.\d+$/.test(m[1])) found.add(m[1]);
      }
    }
  }
  return [...found];
}
