import * as fs from 'fs';
import * as path from 'path';
import { nmapQuick, nmapFull, nmapServices, mergePorts, extractVhosts } from '../tools/nmap';
import { nikto } from '../tools/nikto';
import { gobuster } from '../tools/gobuster';
import { enum4linux } from '../tools/enum4linux';
import { searchsploit } from '../tools/searchsploit';
import { whatweb } from '../tools/whatweb';
import { sqlmap } from '../tools/sqlmap';
import { createSession, saveSession, generateSummary } from '../session';
import { wsl, startSocksProxy } from '../tools/wsl';
import type { Port } from '../types';

const WEB_SERVICES = new Set(['http', 'https', 'http-alt', 'http-proxy', 'ssl/http', 'https-alt']);
const WEB_PORTS = new Set([80, 443, 8080, 8443, 8000, 8888, 3000, 5000, 4443]);
const SMB_SERVICES = new Set(['microsoft-ds', 'netbios-ssn', 'smb']);
const SMB_PORTS = new Set([139, 445]);

const WIN_HOSTS = '/mnt/c/Windows/System32/drivers/etc/hosts';

async function addVhosts(target: string, vhosts: string[]): Promise<void> {
  for (const host of vhosts) {
    const entry = `${target} ${host}`;

    // WSL /etc/hosts
    const { stdout } = await wsl(['grep', '-F', host, '/etc/hosts']);
    if (stdout.includes(host)) {
      console.log(`[recon] ${host} already in WSL /etc/hosts`);
    } else {
      const result = await wsl(['bash', '-c', `echo '${entry}' | sudo tee -a /etc/hosts`]);
      if (result.exitCode === 0) {
        console.log(`[recon] Added ${entry} to WSL /etc/hosts`);
      } else {
        console.warn(`[recon] Could not add to WSL /etc/hosts — add manually: echo '${entry}' | sudo tee -a /etc/hosts`);
      }
    }

    // Windows hosts file (required for browser access)
    const { stdout: winOut } = await wsl(['grep', '-F', host, WIN_HOSTS]);
    if (winOut.includes(host)) {
      console.log(`[recon] ${host} already in Windows hosts`);
    } else {
      const winResult = await wsl(['bash', '-c', `echo '${entry}' | sudo tee -a ${WIN_HOSTS}`]);
      if (winResult.exitCode === 0) {
        console.log(`[recon] Added ${entry} to Windows hosts`);
      } else {
        console.warn(`[recon] Could not add to Windows hosts — add manually (as admin): echo '${entry}' >> C:\\Windows\\System32\\drivers\\etc\\hosts`);
      }
    }
  }
}

function classifyPorts(ports: Port[]) {
  return {
    web: ports.filter((p) => WEB_SERVICES.has(p.service) || WEB_PORTS.has(p.number)),
    smb: ports.filter((p) => SMB_SERVICES.has(p.service) || SMB_PORTS.has(p.number)),
    ssh: ports.filter((p) => p.service === 'ssh' || p.number === 22),
    ftp: ports.filter((p) => p.service === 'ftp' || p.number === 21),
  };
}

export async function runRecon(target: string, machineName: string): Promise<void> {
  startSocksProxy();
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

  const xmlFile = path.join(session.dir, 'nmap-services.xml');
  const vhosts = fs.existsSync(xmlFile) ? extractVhosts(fs.readFileSync(xmlFile, 'utf8')) : [];
  if (vhosts.length > 0) {
    console.log(`[recon] Detected vhost(s): ${vhosts.join(', ')}`);
    await addVhosts(target, vhosts);
  }
  const primaryHost = vhosts[0];

  const { web, smb, ssh, ftp } = classifyPorts(session.ports);

  console.log('\n[recon] Services detected:');
  if (web.length) console.log(`  Web  : ${web.map((p) => p.number).join(', ')}`);
  if (smb.length) console.log(`  SMB  : ${smb.map((p) => p.number).join(', ')}`);
  if (ssh.length) console.log(`  SSH  : ${ssh.map((p) => p.number).join(', ')}`);
  if (ftp.length) console.log(`  FTP  : ${ftp.map((p) => p.number).join(', ')}`);

  // Phase 4: Service-specific enumeration (all in parallel)
  const tasks: Promise<void>[] = [];

  for (const port of web) {
    tasks.push(nikto(target, port, session.dir, primaryHost));
    tasks.push(gobuster(target, port, session.dir, undefined, primaryHost));
    tasks.push(whatweb(target, port, session.dir, primaryHost));
    tasks.push(sqlmap(target, port, session.dir, primaryHost));
  }

  if (smb.length > 0) {
    tasks.push(enum4linux(target, session.dir));
  }

  tasks.push(searchsploit(session.ports, session.dir));

  await Promise.all(tasks);

  session.endTime = new Date().toISOString();
  saveSession(session);
  generateSummary(session);

  const elapsed = Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000);
  console.log(`\n[recon] Done. (${Math.floor(elapsed / 60)}m ${elapsed % 60}s)`);
}
