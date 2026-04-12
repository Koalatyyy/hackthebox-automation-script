# automated-ctfs

CTF recon automation for HackTheBox. Runs on Windows via WSL bridge.

## Setup

```bash
npm install
npm run build
npm link   # makes `ctf` available globally
```

To use `ctf vpn download`, set your HTB API key:
1. Go to `app.hackthebox.com` > Profile > Settings > App Tokens
2. Create a new API token and copy it
3. Add it to a `.env` file in the project root (copy `.env.example`):

```bash
cp .env.example .env
# then edit .env and paste your token after HTB_API_KEY=
```

## Usage

### Recon

```bash
ctf recon <target-ip> -n <machine-name>
```

Runs a 4-phase pipeline:
1. Quick nmap scan (fast port discovery)
2. Full nmap scan (all 65535 ports)
3. Service/script scan on discovered ports
4. Parallel enumeration — nikto, gobuster, whatweb, sqlmap (web) / enum4linux (SMB) / searchsploit (all ports)

Output lands in `sessions/<machine-name>-<timestamp>/`.

### VPN

```bash
ctf vpn connect                      # auto-detects .ovpn in cwd or ~/Downloads
ctf vpn connect <ovpn-file>          # explicit file
ctf vpn download -s <server-id>      # download config by server ID (requires HTB_API_KEY)
ctf vpn download -s <id> --connect   # download and connect in one step
ctf vpn disconnect
ctf vpn status
```

To get your `.ovpn` file manually: `app.hackthebox.com` > **Connect to HTB** (top right) > OpenVPN > select server > **Download VPN**.

### Tools

All tools run automatically via `ctf recon`. Each can also be run standalone. All accept `-o <dir>` to set the output directory (defaults to cwd).

```bash
# Web vulnerability scan
ctf nikto <target> -p <port> [--ssl] [-o <dir>]

# Directory brute-force
ctf gobuster <target> -p <port> [--ssl] [-w <wordlist>] [-o <dir>]

# Web technology fingerprinting
ctf whatweb <target> -p <port> [--ssl] [-o <dir>]

# SQL injection scan
ctf sqlmap <target> -p <port> [--ssl] [-o <dir>]

# SMB enumeration
ctf enum4linux <target> [-o <dir>]

# Exploit database lookup
ctf searchsploit <query...> [-o <dir>]
```

Examples:
```bash
ctf nikto 10.10.10.1 -p 443 --ssl
ctf gobuster 10.10.10.1 -p 80 -w /usr/share/seclists/Discovery/Web-Content/raft-large-words.txt
ctf searchsploit Apache 2.4
ctf searchsploit OpenSSH 7.4
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
    whatweb.ts          # web technology fingerprinting
    sqlmap.ts           # SQL injection scanner
    searchsploit.ts     # exploit database search by service/version
    vpn.ts              # OpenVPN connect/disconnect/download/status
  session/index.ts      # session creation, file management, summary
  platforms/htb.ts      # HackTheBox API (VPN servers, ovpn download)
  types.ts              # Port, Session interfaces
sessions/               # runtime output (gitignored)
```

## Requirements

- Node.js 20+
- WSL with: `nmap`, `nikto`, `gobuster`, `enum4linux`, `openvpn`, `whatweb`, `sqlmap`, `exploitdb` (searchsploit)
- gobuster wordlist: `/usr/share/seclists/Discovery/Web-Content/common.txt`

## WSL Sudoers

The VPN commands run `sudo openvpn` and `sudo kill` inside WSL. To avoid password prompts, add the following via `sudo visudo` in WSL:

```bash
echo "$USER ALL=(ALL) NOPASSWD: /usr/sbin/openvpn, /usr/bin/kill" | sudo tee /etc/sudoers.d/openvpn
echo "$USER ALL=(ALL) NOPASSWD: /usr/bin/nmap" | sudo tee /etc/sudoers.d/nmap
```
