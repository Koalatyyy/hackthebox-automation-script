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

async function htbGet(endpoint: string, baseUrl = BASE_URL): Promise<unknown> {
  const apiKey = loadApiKey();
  const res = await fetch(`${baseUrl}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`HTB API ${baseUrl}${endpoint} returned ${res.status}: ${await res.text()}`);
  }

  return res.json();
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

// Try known candidate paths for server listing across both subdomains.
// Update CANDIDATE_PATHS once the real endpoint is confirmed via DevTools.
const SERVER_LIST_CANDIDATES = [
  { base: LABS_URL, path: '/access/servers' },
  { base: LABS_URL, path: '/lab/list' },
  { base: BASE_URL, path: '/access/servers' },
  { base: BASE_URL, path: '/lab/list' },
];

export async function getVpnServers(): Promise<VpnServer[]> {
  for (const { base, path } of SERVER_LIST_CANDIDATES) {
    try {
      const data = await htbGet(path, base) as { data?: VpnServer[] } | VpnServer[];
      const servers = Array.isArray(data) ? data : (data as { data?: VpnServer[] }).data ?? [];
      if (servers.length > 0) {
        console.log(`[htb] Server list from: ${base}${path}`);
        return servers;
      }
    } catch {
      // try next candidate
    }
  }
  return [];
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

// GET https://labs.hackthebox.com/api/v4/access/ovpnfile/{serverId}/{unknown}/{unknown}
// Confirmed endpoint. The trailing 0/1 params are unknown - default works for standard lab access.
export async function downloadOvpn(serverId: number, outPath: string): Promise<void> {
  const buf = await htbGetBinary(LABS_URL, `/access/ovpnfile/${serverId}/0/1`);
  fs.writeFileSync(outPath, buf);
}
