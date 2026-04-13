import { wsl } from './wsl';

type InstallMethod =
  | { type: 'apt';    package: string }
  | { type: 'go';     module: string }
  | { type: 'pip';    package: string }
  | { type: 'script'; commands: string[] };

interface Tool {
  bin: string;
  install: InstallMethod[];
}

const TOOLS: Tool[] = [
  {
    bin: 'nmap',
    install: [{ type: 'apt', package: 'nmap' }],
  },
  {
    bin: 'nikto',
    install: [{ type: 'apt', package: 'nikto' }],
  },
  {
    bin: 'gobuster',
    install: [
      { type: 'apt', package: 'gobuster' },
      { type: 'go',  module: 'github.com/OJ/gobuster/v3@latest' },
    ],
  },
  {
    bin: 'sqlmap',
    install: [
      { type: 'apt', package: 'sqlmap' },
      { type: 'pip', package: 'sqlmap' },
    ],
  },
  {
    bin: 'whatweb',
    install: [
      { type: 'apt', package: 'whatweb' },
      {
        type: 'script',
        commands: [
          'sudo git clone https://github.com/urbanadventurer/WhatWeb.git /opt/whatweb',
          'sudo ln -sf /opt/whatweb/whatweb /usr/local/bin/whatweb',
          'cd /opt/whatweb && sudo gem install bundler && sudo bundle install',
        ],
      },
    ],
  },
  {
    bin: 'enum4linux',
    install: [
      { type: 'apt', package: 'enum4linux' },
      {
        type: 'script',
        commands: [
          'sudo git clone https://github.com/CiscoCXSecurity/enum4linux.git /opt/enum4linux',
          'sudo ln -sf /opt/enum4linux/enum4linux.pl /usr/local/bin/enum4linux',
        ],
      },
    ],
  },
  {
    bin: 'searchsploit',
    install: [
      { type: 'apt', package: 'exploitdb' },
      {
        type: 'script',
        commands: [
          'sudo git clone https://gitlab.com/exploit-database/exploitdb.git /opt/exploitdb',
          'sudo ln -sf /opt/exploitdb/searchsploit /usr/local/bin/searchsploit',
        ],
      },
    ],
  },
];

async function isInstalled(bin: string): Promise<boolean> {
  const result = await wsl(['which', bin]);
  return result.exitCode === 0;
}

async function tryInstall(tool: Tool): Promise<boolean> {
  for (const method of tool.install) {
    let commands: string[][];

    if (method.type === 'apt') {
      commands = [['sudo', 'apt-get', 'install', '-y', method.package]];
    } else if (method.type === 'go') {
      commands = [['go', 'install', method.module]];
    } else if (method.type === 'pip') {
      commands = [['pip3', 'install', '--user', method.package]];
    } else {
      commands = method.commands.map(c => ['bash', '-c', c]);
    }

    console.log(`  [${method.type}] installing ${tool.bin}...`);
    let ok = true;
    for (const cmd of commands) {
      const result = await wsl(cmd, (chunk) => process.stdout.write(chunk));
      if (result.exitCode !== 0) { ok = false; break; }
    }

    if (ok && await isInstalled(tool.bin)) return true;
    console.log(`  [${method.type}] failed, trying next method...`);
  }
  return false;
}

export async function runSetup(): Promise<void> {
  const missing: Tool[] = [];

  console.log('[setup] Checking tools...');
  for (const tool of TOOLS) {
    const found = await isInstalled(tool.bin);
    console.log(`  ${found ? '✓' : '✗'} ${tool.bin}`);
    if (!found) missing.push(tool);
  }

  if (missing.length === 0) {
    console.log('[setup] All tools installed.');
    return;
  }

  console.log(`\n[setup] Installing ${missing.length} missing tool(s)...\n`);

  const failed: string[] = [];
  for (const tool of missing) {
    const ok = await tryInstall(tool);
    if (!ok) {
      console.error(`  [!] Could not install ${tool.bin} via any method.`);
      failed.push(tool.bin);
    }
  }

  if (failed.length > 0) {
    console.error(`\n[setup] Failed to install: ${failed.join(', ')}`);
    process.exit(1);
  }

  console.log('\n[setup] Done.');
}
