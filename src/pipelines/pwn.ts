import { vpnConnect } from '../tools/vpn';
import { searchMachine, spawnMachine, getActiveMachine } from '../platforms/htb';
import { runRecon } from './recon';

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
  // 1. VPN
  console.log('[pwn] Step 1/4: VPN');
  await vpnConnect();

  // 2. Find machine
  console.log(`[pwn] Step 2/4: Searching for "${machineName}"...`);
  const results = await searchMachine(machineName);
  if (results.length === 0) throw new Error(`No machine found matching "${machineName}"`);

  const machine = results.find((m) => m.name.toLowerCase() === machineName.toLowerCase()) ?? results[0];
  console.log(`[pwn] Found: ${machine.name} (ID ${machine.id}, ${machine.difficulty}${machine.retired ? ', retired' : ''})`);

  // 3. Spawn
  console.log('[pwn] Step 3/4: Spawning machine...');
  await spawnMachine(machine.id);

  // 4. Wait for IP then recon
  const ip = await waitForIp(machine.id);
  console.log(`[pwn] Step 4/4: Machine live at ${ip}`);

  await runRecon(ip, machine.name);
}
