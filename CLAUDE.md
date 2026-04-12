# Project Instructions

## Stack
- TypeScript / Node.js
- Tools run via WSL bridge (`wsl.exe -- <cmd>`)
- Target platform: HackTheBox

## Structure
```
src/
  cli/          # Entry point (commander)
  pipelines/    # recon.ts - orchestrates the full scan sequence
  tools/        # wsl.ts, nmap.ts, nikto.ts, gobuster.ts, enum4linux.ts
  session/      # Session creation, file management, summary generation
  types.ts      # Shared interfaces (Port, Session)
sessions/       # Runtime output - gitignored
```

## Commands
```bash
npm install
npm run build
npm run dev -- recon <target-ip> --name <machine-name>
# or after build:
node dist/cli/index.js recon <target-ip> --name <machine-name>
```

## Conventions
- Each tool wrapper in `src/tools/` streams output to stdout and writes raw file to session dir
- nmap output is parsed from XML (`-oX`) into typed `Port[]`
- Service classification in `pipelines/recon.ts` drives which tools run
- gobuster wordlist defaults to `/usr/share/seclists/Discovery/Web-Content/common.txt`
- All tool output files land in `sessions/<machine>-<timestamp>/`
