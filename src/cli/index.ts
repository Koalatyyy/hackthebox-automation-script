#!/usr/bin/env node
import { Command } from 'commander';
import { runRecon } from '../pipelines/recon';
import { vpnConnect, vpnDisconnect, vpnStatus, vpnDownload } from '../tools/vpn';

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

program.parse();
