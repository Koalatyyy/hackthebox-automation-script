import * as fs from 'fs';
import * as path from 'path';
import type { Session } from '../types';

const SESSIONS_DIR = path.join(process.cwd(), 'sessions');

export function createSession(target: string, machineName: string): Session {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = path.join(SESSIONS_DIR, `${machineName}-${timestamp}`);
  fs.mkdirSync(dir, { recursive: true });

  const session: Session = {
    target,
    machineName,
    startTime: new Date().toISOString(),
    dir,
    ports: [],
  };

  saveSession(session);
  return session;
}

export function saveSession(session: Session): void {
  fs.writeFileSync(
    path.join(session.dir, 'session.json'),
    JSON.stringify(session, null, 2),
    'utf8'
  );
}

export function generateSummary(session: Session): void {
  const lines = [
    `# Recon Summary: ${session.machineName}`,
    ``,
    `**Target:** ${session.target}`,
    `**Started:** ${session.startTime}`,
    ``,
    `## Open Ports`,
    ``,
    `| Port | Protocol | Service | Product | Version |`,
    `|------|----------|---------|---------|---------|`,
    ...session.ports.map(
      (p) => `| ${p.number} | ${p.protocol} | ${p.service} | ${p.product ?? '-'} | ${p.version ?? '-'} |`
    ),
    ``,
    `## Output Files`,
    ``,
    ...fs
      .readdirSync(session.dir)
      .filter((f) => f !== 'summary.md')
      .map((f) => `- \`${f}\``),
  ];

  const summaryPath = path.join(session.dir, 'summary.md');
  fs.writeFileSync(summaryPath, lines.join('\n'), 'utf8');
  console.log(`\n[summary] ${summaryPath}`);
}
