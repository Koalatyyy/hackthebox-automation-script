# automated-ctfs

CTF recon automation for HackTheBox. Runs on Windows via WSL bridge.

## Setup

```bash
npm install
npm run build
npm link   # makes `ctf` available globally
```

Set `HTB_API_KEY` in your environment to use `ctf vpn download`.

## Usage

### Recon

```bash
ctf recon <target-ip> --name <machine-name>
# dev mode (no build required):
npm run dev -- recon <target-ip> --name <machine-name>
```

Runs a 4-phase pipeline:
1. Quick nmap scan (fast port discovery)
2. Full nmap scan (all 65535 ports)
3. Service/script scan on discovered ports
4. Parallel service enumeration — nikto + gobuster (web), enum4linux (SMB)

Output lands in `sessions/<machine>-<timestamp>/`.

### VPN

```bash
ctf vpn connect [ovpn-file]    # auto-detects .ovpn in cwd or ~/Downloads
ctf vpn download               # download config via HTB API
ctf vpn download --server <id> # download specific server
ctf vpn download --connect     # download and connect in one step
ctf vpn disconnect
ctf vpn status
```

## Architecture

```
src/
  cli/index.ts          # commander entry point
  pipelines/recon.ts    # full scan orchestration
  tools/
    wsl.ts              # WSL bridge (wsl.exe runner)
    nmap.ts             # quick / full / service scans, XML -> Port[]
    nikto.ts            # web vulnerability scanner
    gobuster.ts         # directory brute-force
    enum4linux.ts       # SMB enumeration
    vpn.ts              # OpenVPN connect/disconnect/download/status
  session/index.ts      # session creation, file management, summary
  platforms/htb.ts      # HackTheBox API (VPN servers, ovpn download)
  types.ts              # Port, Session interfaces
sessions/               # runtime output (gitignored)
```

## Requirements

- Node.js 20+
- WSL with: `nmap`, `nikto`, `gobuster`, `enum4linux`, `openvpn`
- gobuster wordlist: `/usr/share/seclists/Discovery/Web-Content/common.txt`

## WSL Sudoers

The VPN commands run `sudo openvpn` and `sudo kill` inside WSL. To avoid password prompts, add the following via `sudo visudo` in WSL:

```bash
echo "$USER ALL=(ALL) NOPASSWD: /usr/sbin/openvpn, /usr/bin/kill" | sudo tee /etc/sudoers.d/openvpn
echo "$USER ALL=(ALL) NOPASSWD: /usr/bin/nmap" | sudo tee /etc/sudoers.d/nmap
```
