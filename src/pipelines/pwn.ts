import { vpnConnect } from '../tools/vpn';
import { searchMachine, spawnMachine, getActiveMachine } from '../platforms/htb';
import { runRecon } from './recon';
import { startSocksProxy } from '../tools/wsl';

async function waitForIp(machineId: number, timeoutMs = 120_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  process.stdout.write('[pwn] Waiting for machine IP');
  while (Date.now() < deadline) {
    const active = await getActiveMachine();
    if (active && active.id === machineId && active.ip) {
      process.stdout.write('\n');
      return active.ip;
    }
    await new Promise((r) => setTimeout(r, 5000));
    process.stdout.write('.');
  }
  process.stdout.write('\n');
  throw new Error('Timed out waiting for machine IP');
}

export async function runPwn(machineName: string): Promise<void> {
  startSocksProxy();

  // 1. VPN
  console.log('[pwn] Step 1/4: VPN');
  await vpnConnect();

  // 2. Find machine
  console.log(`[pwn] Step 2/4: Searching for "${machineName}"...`);
  const machine = await searchMachine(machineName);
  console.log(`[pwn] Found: ${machine.name} (ID ${machine.id}, ${machine.difficulty}${machine.retired ? ', retired' : ''})`);

  if (machine.retired) {
    console.warn('[pwn] Warning: this is a retired machine and requires a VIP/VIP+ subscription to spawn.');
    const { confirm } = await import('../tools/prompt');
    const yes = await confirm('[pwn] Continue anyway?');
    if (!yes) process.exit(0);
  }

  // 3. Spawn
  console.log('[pwn] Step 3/4: Spawning machine...');
  if (machine.isReleaseArena) {
    console.error('[pwn] Cannot spawn: this is a Release Arena machine. Connect to a Release Arena VPN server first.');
    process.exit(1);
  }
  const already = await getActiveMachine();
  if (already && already.id === machine.id) {
    console.log('[pwn] Machine already active, skipping spawn.');
  } else {
    try {
      await spawnMachine(machine.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('already have an active instance')) {
        console.log('[pwn] Machine already active, skipping spawn.');
      } else if (msg.includes('non-free machine')) {
        console.error('[pwn] Cannot spawn retired machine on a free server. Upgrade to VIP at app.hackthebox.com.');
        process.exit(1);
      } else if (msg.includes('Release Arena')) {
        console.error('[pwn] Cannot spawn: this is a Release Arena machine. Connect to a Release Arena VPN server first.');
        process.exit(1);
      } else {
        console.error(`[pwn] Spawn failed: ${msg}`);
        process.exit(1);
      }
    }
  }

  // 4. Wait for IP then recon
  const ip = await waitForIp(machine.id);
  console.log(`[pwn] Step 4/4: Machine live at ${ip}`);

  await runRecon(ip, machine.name);
}
