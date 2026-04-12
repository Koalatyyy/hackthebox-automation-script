import { nmapQuick, nmapFull, nmapServices, mergePorts } from '../tools/nmap';
import { nikto } from '../tools/nikto';
import { gobuster } from '../tools/gobuster';
import { enum4linux } from '../tools/enum4linux';
import { createSession, saveSession, generateSummary } from '../session';
import type { Port } from '../types';

const WEB_SERVICES = new Set(['http', 'https', 'http-alt', 'http-proxy', 'ssl/http', 'https-alt']);
const WEB_PORTS = new Set([80, 443, 8080, 8443, 8000, 8888, 3000, 5000, 4443]);
const SMB_SERVICES = new Set(['microsoft-ds', 'netbios-ssn', 'smb']);
const SMB_PORTS = new Set([139, 445]);

function classifyPorts(ports: Port[]) {
  return {
    web: ports.filter((p) => WEB_SERVICES.has(p.service) || WEB_PORTS.has(p.number)),
    smb: ports.filter((p) => SMB_SERVICES.has(p.service) || SMB_PORTS.has(p.number)),
    ssh: ports.filter((p) => p.service === 'ssh' || p.number === 22),
    ftp: ports.filter((p) => p.service === 'ftp' || p.number === 21),
  };
}

export async function runRecon(target: string, machineName: string): Promise<void> {
  const session = createSession(target, machineName);
  console.log(`\n[recon] Session: ${session.dir}`);
  console.log(`[recon] Target:  ${target}`);

  // Phase 1: Quick scan - fast initial port discovery
  const quickPorts = await nmapQuick(target, session.dir);
  console.log(`[nmap] Quick: ${quickPorts.length} open port(s)`);

  // Phase 2: Full scan - catch anything on non-standard ports
  const fullPorts = await nmapFull(target, session.dir);
  const allPorts = mergePorts(quickPorts, fullPorts);
  console.log(`[nmap] Full: ${allPorts.length} open port(s) total`);

  // Phase 3: Service/script scan on all discovered ports
  const servicePorts = await nmapServices(target, allPorts, session.dir);
  session.ports = mergePorts(allPorts, servicePorts);
  saveSession(session);

  const { web, smb, ssh, ftp } = classifyPorts(session.ports);

  console.log('\n[recon] Services detected:');
  if (web.length) console.log(`  Web  : ${web.map((p) => p.number).join(', ')}`);
  if (smb.length) console.log(`  SMB  : ${smb.map((p) => p.number).join(', ')}`);
  if (ssh.length) console.log(`  SSH  : ${ssh.map((p) => p.number).join(', ')}`);
  if (ftp.length) console.log(`  FTP  : ${ftp.map((p) => p.number).join(', ')}`);

  // Phase 4: Service-specific enumeration (all in parallel)
  const tasks: Promise<void>[] = [];

  for (const port of web) {
    tasks.push(nikto(target, port, session.dir));
    tasks.push(gobuster(target, port, session.dir));
  }

  if (smb.length > 0) {
    tasks.push(enum4linux(target, session.dir));
  }

  await Promise.all(tasks);

  generateSummary(session);
  console.log('\n[recon] Done.');
}
