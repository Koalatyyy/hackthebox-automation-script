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
4. Parallel service enumeration — nikto + gobuster + whatweb + sqlmap (web), enum4linux (SMB), searchsploit (all ports)

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

## Tools

All tools are invoked automatically by `ctf recon`. To run them manually via WSL:

**nmap** — port scanning
```bash
wsl -- nmap -T4 -F 10.10.10.1                                          # quick
wsl -- nmap -T4 -p- 10.10.10.1                                         # full
wsl -- nmap -sV -sC -p 22,80,443 10.10.10.1                            # service/script
```

**nikto** — web vulnerability scanner
```bash
wsl -- nikto -h 10.10.10.1 -p 80 -output nikto.txt
wsl -- nikto -h 10.10.10.1 -p 443 -ssl -output nikto-443.txt
```

**gobuster** — directory brute-force
```bash
wsl -- gobuster dir -u http://10.10.10.1:80 -w /usr/share/seclists/Discovery/Web-Content/common.txt -o gobuster.txt -t 50 --no-error
```

**whatweb** — web technology fingerprinting
```bash
wsl -- whatweb -v -a 3 http://10.10.10.1:80 --log-brief whatweb.txt
```

**sqlmap** — SQL injection scanner
```bash
wsl -- sqlmap -u http://10.10.10.1:80 --batch --crawl=2 --level=2 --risk=1 --output-dir ./sqlmap-out
```

**enum4linux** — SMB enumeration
```bash
wsl -- enum4linux -a 10.10.10.1
```

**searchsploit** — exploit database lookup
```bash
wsl -- searchsploit --json "Apache 2.4"
wsl -- searchsploit --json "OpenSSH 7.4"
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
