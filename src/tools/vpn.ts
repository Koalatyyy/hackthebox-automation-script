import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { wsl, wslDetached, toWslPath } from './wsl';
import { getVpnServers, downloadOvpn } from '../platforms/htb';

// Common locations to search for .ovpn files
const OVPN_SEARCH_DIRS = [
  path.join(process.cwd()),
  path.join(os.homedir(), 'Downloads'),
  // Windows Downloads folder accessible from WSL host
  `C:\\Users\\${os.userInfo().username}\\Downloads`,
];

function findOvpnFile(): string | null {
  for (const dir of OVPN_SEARCH_DIRS) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ovpn'));
    if (files.length === 1) {
      const found = path.join(dir, files[0]);
      console.log(`[vpn] Auto-detected: ${found}`);
      return found;
    }
    if (files.length > 1) {
      console.log(`[vpn] Multiple .ovpn files found in ${dir}:`);
      files.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
      console.log('[vpn] Specify one explicitly: ctf vpn connect <file>');
      process.exit(1);
    }
  }
  return null;
}

const STATE_FILE = path.join(process.cwd(), '.vpn-state.json');
const PID_FILE = '/tmp/ctf-ovpn.pid';
const LOG_FILE = '/tmp/ctf-ovpn.log';

interface VpnState {
  configFile: string;
  startTime: string;
}

function saveState(state: VpnState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function clearState(): void {
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
}

function loadState(): VpnState | null {
  if (!fs.existsSync(STATE_FILE)) return null;
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as VpnState;
}

async function getTunIp(): Promise<string | null> {
  const { stdout } = await wsl(['ip', '-4', 'addr', 'show', 'tun0']);
  const match = stdout.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
  return match?.[1] ?? null;
}

async function isTunUp(): Promise<boolean> {
  const { exitCode } = await wsl(['ip', 'link', 'show', 'tun0']);
  return exitCode === 0;
}

async function waitForTun(timeoutMs = 30000): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isTunUp()) {
      return getTunIp();
    }
    await new Promise((r) => setTimeout(r, 1000));
    process.stdout.write('.');
  }
  return null;
}

export async function vpnConnect(ovpnFile?: string): Promise<void> {
  const resolved = ovpnFile ?? findOvpnFile();
  if (!resolved) {
    console.error('[vpn] No .ovpn file found. Download one with: ctf vpn download');
    process.exit(1);
  }
  if (!fs.existsSync(resolved)) {
    console.error(`[vpn] Config not found: ${resolved}`);
    process.exit(1);
  }
  ovpnFile = resolved;

  if (await isTunUp()) {
    const ip = await getTunIp();
    console.log(`[vpn] Already connected (tun0: ${ip})`);
    return;
  }

  const wslConfig = toWslPath(path.resolve(ovpnFile as string));
  console.log(`[vpn] Connecting with ${path.basename(ovpnFile as string)}...`);

  wslDetached([
    'bash', '-c',
    `sudo openvpn --config ${wslConfig} --daemon --log ${LOG_FILE} --writepid ${PID_FILE} </dev/null`,
  ]);

  process.stdout.write('[vpn] Waiting for tun0');
  const ip = await waitForTun();

  if (!ip) {
    console.log('\n[vpn] Timed out waiting for tun0. Check: wsl -- cat /tmp/ctf-ovpn.log');
    process.exit(1);
  }

  console.log(`\n[vpn] Connected. tun0: ${ip}`);
  saveState({ configFile: path.resolve(ovpnFile as string), startTime: new Date().toISOString() });
}

export async function vpnDisconnect(): Promise<void> {
  let pid = '';

  const { stdout: pidFromFile } = await wsl(['cat', PID_FILE]);
  pid = pidFromFile.trim();

  if (!pid) {
    if (!(await isTunUp())) {
      console.log('[vpn] Not connected.');
      clearState();
      return;
    }
    // tun0 is up but no PID file — find the process directly
    const { stdout: pgrepOut } = await wsl(['pgrep', '-x', 'openvpn']);
    pid = pgrepOut.trim().split('\n')[0];
    if (!pid) {
      console.log('[vpn] tun0 is up but could not find openvpn process.');
      clearState();
      return;
    }
  }

  console.log(`[vpn] Killing openvpn (PID ${pid})...`);
  await wsl(['sudo', 'kill', pid]);

  // Wait for tun0 to drop
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (!(await isTunUp())) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  clearState();
  console.log('[vpn] Disconnected.');
}

export async function vpnDownload(serverId?: number): Promise<string> {
  // If server ID is known, skip listing entirely and download directly
  if (serverId !== undefined) {
    console.log(`[vpn] Downloading config for server ${serverId}...`);
    const outPath = path.join(process.cwd(), `htb-server-${serverId}.ovpn`);
    await downloadOvpn(serverId, outPath);
    console.log(`[vpn] Saved to ${outPath}`);
    return outPath;
  }

  const servers = await getVpnServers();

  if (servers.length === 0) {
    console.error('[vpn] Could not retrieve server list from HTB API.');
    console.error('[vpn] Download your .ovpn file manually: app.hackthebox.com > Connect to HTB (top right) > OpenVPN > Download VPN');
    console.error('[vpn] Then connect with: ctf vpn connect <file.ovpn>');
    process.exit(1);
  }

  let server = servers.find((s) => s.assigned);

  if (serverId !== undefined) {
    server = servers.find((s) => s.id === serverId);
    if (!server) {
      console.error(`[vpn] Server ID ${serverId} not found.`);
      process.exit(1);
    }
  }

  if (!server) {
    console.log('[vpn] Available servers:');
    servers.forEach((s) => console.log(`  ${s.id}  ${s.friendly_name} (${s.location}) - ${s.current_clients} clients`));
    console.log('\n[vpn] No assigned server found. Run with --server <id> to pick one.');
    process.exit(1);
  }

  console.log(`[vpn] Downloading config for: ${server.friendly_name}`);
  const outPath = path.join(process.cwd(), `htb-${server.friendly_name.replace(/\s+/g, '-').toLowerCase()}.ovpn`);
  await downloadOvpn(server.id, outPath);
  console.log(`[vpn] Saved to ${outPath}`);
  return outPath;
}

export async function vpnStatus(): Promise<void> {
  const up = await isTunUp();
  if (!up) {
    console.log('[vpn] Not connected (no tun0 interface).');
    return;
  }

  const ip = await getTunIp();
  const state = loadState();

  console.log(`[vpn] Connected`);
  console.log(`  tun0 IP  : ${ip}`);
  if (state) {
    console.log(`  Config   : ${state.configFile}`);
    console.log(`  Since    : ${state.startTime}`);
  }
}
