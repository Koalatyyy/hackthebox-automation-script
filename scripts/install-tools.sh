#!/usr/bin/env bash
set -euo pipefail

TOOLS_DIR="$HOME/tools"
mkdir -p "$TOOLS_DIR"

apt_packages=(
  nmap nikto gobuster seclists
  ffuf feroxbuster whatweb
  openvpn
  curl wget git python3 python3-pip
  samba-common-bin ldap-utils  # enum4linux deps
)

echo "[*] Updating apt..."
sudo apt update -qq

echo "[*] Installing apt packages..."
sudo apt install -y "${apt_packages[@]}"

# enum4linux - manual if not in apt
if ! command -v enum4linux &>/dev/null; then
  echo "[*] Installing enum4linux from source..."
  git clone --depth=1 https://github.com/CiscoCXSecurity/enum4linux "$TOOLS_DIR/enum4linux"
  sudo ln -sf "$TOOLS_DIR/enum4linux/enum4linux.pl" /usr/local/bin/enum4linux
fi

# feroxbuster - fallback if apt version missing
if ! command -v feroxbuster &>/dev/null; then
  echo "[*] Installing feroxbuster..."
  curl -sL https://raw.githubusercontent.com/epi052/feroxbuster/main/install-nix.sh | bash -s -- "$TOOLS_DIR"
  sudo ln -sf "$TOOLS_DIR/feroxbuster" /usr/local/bin/feroxbuster
fi

echo ""
echo "[*] Verification:"
for tool in nmap nikto gobuster enum4linux ffuf feroxbuster whatweb openvpn; do
  if command -v "$tool" &>/dev/null; then
    echo "  [+] $tool"
  else
    echo "  [-] $tool (not found)"
  fi
done

echo ""
echo "[*] Done."
