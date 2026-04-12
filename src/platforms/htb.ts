import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://www.hackthebox.com/api/v4';
const LABS_URL = 'https://labs.hackthebox.com/api/v4';

export interface VpnServer {
  id: number;
  friendly_name: string;
  location: string;
  current_clients: number;
  assigned: boolean;
}

export interface ConnectionStatus {
  status: string;
  server?: string;
  ip?: string;
}

function loadApiKey(): string {
  if (process.env.HTB_API_KEY) return process.env.HTB_API_KEY;

  const envFile = path.join(process.cwd(), '.env');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
      const match = line.match(/^HTB_API_KEY\s*=\s*(.+)$/);
      if (match) return match[1].trim().replace(/^["']|["']$/g, '');
    }
  }

  console.error('[htb] HTB_API_KEY not set. Add it to .env or export it as an env variable.');
  process.exit(1);
}

async function htbRequest(method: string, endpoint: string, baseUrl = BASE_URL, body?: unknown): Promise<unknown> {
  const apiKey = loadApiKey();
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    throw new Error(`HTB API ${method} ${baseUrl}${endpoint} returned ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

async function htbGet(endpoint: string, baseUrl = BASE_URL): Promise<unknown> {
  return htbRequest('GET', endpoint, baseUrl);
}

async function htbGetBinary(baseUrl: string, endpoint: string): Promise<Buffer> {
  const apiKey = loadApiKey();
  const res = await fetch(`${baseUrl}${endpoint}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    throw new Error(`HTB API ${endpoint} returned ${res.status}: ${await res.text()}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

// Documented server IDs from https://github.com/D3vil0p3r/HackTheBox-API
const KNOWN_SERVERS: VpnServer[] = [
  { id: 1,   friendly_name: 'EU Free 1',          location: 'EU', current_clients: 0, assigned: false },
  { id: 201, friendly_name: 'EU Free 2',          location: 'EU', current_clients: 0, assigned: false },
  { id: 253, friendly_name: 'EU Free 3',          location: 'EU', current_clients: 0, assigned: false },
  { id: 113, friendly_name: 'US Free 1',          location: 'US', current_clients: 0, assigned: false },
  { id: 202, friendly_name: 'US Free 2',          location: 'US', current_clients: 0, assigned: false },
  { id: 254, friendly_name: 'US Free 3',          location: 'US', current_clients: 0, assigned: false },
  { id: 177, friendly_name: 'AU Free 1',          location: 'AU', current_clients: 0, assigned: false },
  { id: 251, friendly_name: 'SG Free 1',          location: 'SG', current_clients: 0, assigned: false },
  { id: 412, friendly_name: 'EU Starting Point 1',location: 'EU', current_clients: 0, assigned: false },
  { id: 414, friendly_name: 'US Starting Point 1',location: 'US', current_clients: 0, assigned: false },
];

export async function getVpnServers(): Promise<VpnServer[]> {
  return KNOWN_SERVERS;
}

export async function getConnectionStatus(): Promise<ConnectionStatus> {
  // Try both subdomains
  for (const base of [LABS_URL, BASE_URL]) {
    try {
      return await htbGet('/user/connection/status', base) as ConnectionStatus;
    } catch {
      // try next
    }
  }
  return { status: 'unknown' };
}

async function switchServer(serverId: number): Promise<void> {
  await htbRequest('POST', `/connections/servers/switch/${serverId}`, LABS_URL);
}

export async function downloadOvpn(serverId: number, outPath: string): Promise<void> {
  await switchServer(serverId);
  const buf = await htbGetBinary(LABS_URL, `/access/ovpnfile/${serverId}/0`);
  fs.writeFileSync(outPath, buf);
}

export interface Machine {
  id: number;
  name: string;
  ip: string | null;
  difficulty: string;
  retired: boolean;
}

export async function searchMachine(name: string): Promise<Machine> {
  const data = await htbGet(`/machine/profile/${encodeURIComponent(name)}`, LABS_URL) as { info: { id: number; name: string; ip: string | null; difficultyText: string; retired: number } };
  const m = data.info;
  return { id: m.id, name: m.name, ip: m.ip ?? null, difficulty: m.difficultyText, retired: m.retired === 1 };
}

export async function spawnMachine(id: number): Promise<void> {
  await htbRequest('POST', '/vm/spawn', LABS_URL, { machine_id: id });
}

export async function getActiveMachine(): Promise<{ id: number; name: string; ip: string } | null> {
  const data = await htbGet('/machine/active') as { info: { id: number; name: string; ip: string } | null };
  return data.info ?? null;
}

export async function stopMachine(id: number): Promise<void> {
  await htbRequest('POST', `/machine/stop/${id}`);
}
