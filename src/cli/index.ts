#!/usr/bin/env node
import { Command } from 'commander';
import { runRecon } from '../pipelines/recon';
import { runPwn } from '../pipelines/pwn';
import { vpnConnect, vpnDisconnect, vpnStatus, vpnDownload } from '../tools/vpn';
import { listMachines } from '../platforms/htb';
import { nikto } from '../tools/nikto';
import { gobuster } from '../tools/gobuster';
import { whatweb } from '../tools/whatweb';
import { sqlmap } from '../tools/sqlmap';
import { enum4linux } from '../tools/enum4linux';
import { searchsploit } from '../tools/searchsploit';
import type { Port } from '../types';

function makePort(portNum: number, ssl: boolean): Port {
  return {
    number: portNum,
    protocol: 'tcp',
    state: 'open',
    service: ssl || portNum === 443 ? 'https' : 'http',
  };
}

const program = new Command();

program
  .name('ctf')
  .description('CTF recon automation for HackTheBox')
  .version('0.1.0');

program
  .command('recon <target>')
  .description('Run full recon pipeline against a target IP')
  .option('-n, --name <name>', 'Machine name for session directory', 'unknown')
  .action(async (target: string, opts: { name: string }) => {
    await runRecon(target, opts.name);
  });

const vpn = program.command('vpn').description('Manage HackTheBox VPN connection');

vpn
  .command('connect [ovpn-file]')
  .description('Connect to HTB VPN - auto-detects .ovpn if not specified')
  .action(async (ovpnFile?: string) => {
    await vpnConnect(ovpnFile);
  });

vpn
  .command('download')
  .description('Download .ovpn config from HTB API (requires HTB_API_KEY)')
  .option('-s, --server <id>', 'VPN server ID (lists available if omitted)', parseInt)
  .option('--connect', 'Connect immediately after downloading')
  .action(async (opts: { server?: number; connect?: boolean }) => {
    const outPath = await vpnDownload(opts.server);
    if (opts.connect) await vpnConnect(outPath);
  });

vpn
  .command('disconnect')
  .description('Disconnect from HTB VPN')
  .action(async () => {
    await vpnDisconnect();
  });

vpn
  .command('status')
  .description('Show current VPN connection status')
  .action(async () => {
    await vpnStatus();
  });

program
  .command('nikto <target>')
  .description('Web vulnerability scan')
  .requiredOption('-p, --port <port>', 'Target port', parseInt)
  .option('--ssl', 'Force SSL')
  .option('-o, --out <dir>', 'Output directory', process.cwd())
  .action(async (target: string, opts: { port: number; ssl: boolean; out: string }) => {
    await nikto(target, makePort(opts.port, opts.ssl), opts.out);
  });

program
  .command('gobuster <target>')
  .description('Directory brute-force')
  .requiredOption('-p, --port <port>', 'Target port', parseInt)
  .option('--ssl', 'Force SSL')
  .option('-w, --wordlist <path>', 'Wordlist path')
  .option('-o, --out <dir>', 'Output directory', process.cwd())
  .action(async (target: string, opts: { port: number; ssl: boolean; wordlist?: string; out: string }) => {
    await gobuster(target, makePort(opts.port, opts.ssl), opts.out, opts.wordlist);
  });

program
  .command('whatweb <target>')
  .description('Web technology fingerprint')
  .requiredOption('-p, --port <port>', 'Target port', parseInt)
  .option('--ssl', 'Force SSL')
  .option('-o, --out <dir>', 'Output directory', process.cwd())
  .action(async (target: string, opts: { port: number; ssl: boolean; out: string }) => {
    await whatweb(target, makePort(opts.port, opts.ssl), opts.out);
  });

program
  .command('sqlmap <target>')
  .description('SQL injection scan')
  .requiredOption('-p, --port <port>', 'Target port', parseInt)
  .option('--ssl', 'Force SSL')
  .option('-o, --out <dir>', 'Output directory', process.cwd())
  .action(async (target: string, opts: { port: number; ssl: boolean; out: string }) => {
    await sqlmap(target, makePort(opts.port, opts.ssl), opts.out);
  });

program
  .command('enum4linux <target>')
  .description('SMB enumeration')
  .option('-o, --out <dir>', 'Output directory', process.cwd())
  .action(async (target: string, opts: { out: string }) => {
    await enum4linux(target, opts.out);
  });

program
  .command('searchsploit <query...>')
  .description('Search exploit database by service/version')
  .option('-o, --out <dir>', 'Output directory', process.cwd())
  .action(async (query: string[], opts: { out: string }) => {
    const port = { number: 0, protocol: 'tcp' as const, state: 'open' as const, service: query.join(' '), product: query[0], version: query.slice(1).join(' ') || undefined };
    await searchsploit([port], opts.out);
  });

program
  .command('machines')
  .description('List available HackTheBox machines (requires HTB_API_KEY)')
  .option('--retired', 'List retired machines instead of active (requires VIP)')
  .option('-d, --difficulty <level>', 'Filter by difficulty (Easy, Medium, Hard, Insane)')
  .option('--os <os>', 'Filter by OS (Linux, Windows, etc.)')
  .action(async (opts: { retired?: boolean; difficulty?: string; os?: string }) => {
    const machines = await listMachines(opts.retired ?? false);
    const filtered = machines.filter(m => {
      if (opts.difficulty && m.difficulty.toLowerCase() !== opts.difficulty.toLowerCase()) return false;
      if (opts.os && m.os.toLowerCase() !== opts.os.toLowerCase()) return false;
      return true;
    });
    const pad = (s: string, n: number) => s.padEnd(n);
    console.log(`${pad('ID', 6)}${pad('Name', 24)}${pad('OS', 10)}${pad('Difficulty', 12)}${'Stars'}`);
    console.log('-'.repeat(58));
    for (const m of filtered) {
      console.log(`${pad(String(m.id), 6)}${pad(m.name, 24)}${pad(m.os, 10)}${pad(m.difficulty, 12)}${m.stars.toFixed(1)}`);
    }
    console.log(`\n${filtered.length} machine(s) listed`);
  });

program
  .command('pwn <machine>')
  .description('Full auto: VPN → spawn machine → recon (requires HTB_API_KEY)')
  .action(async (machine: string) => {
    await runPwn(machine);
  });

program.parse();
