Cloudflare Tunnel + browser SSH on ssh2.maddox.page (Fedora Linux ARM64 origin)

This guide sets up in-browser SSH from your laptop to a Fedora ARM64 server through Cloudflare Tunnel + Cloudflare Access (Zero Trust). It also covers the root requirement and the one gotcha that usually breaks root logins.

What you’re building

Laptop (browser) → https://ssh2.maddox.page → Cloudflare Access (auth) → Cloudflare Tunnel → sshd on your Fedora box (usually localhost:22)

Cloudflare’s browser terminal for SSH requires routing SSH through a public hostname and the user logs in using their Cloudflare Access identity.

Critical “root” reality check (read this first)

Cloudflare’s browser-rendered SSH has a hard requirement:

Your user’s email prefix must match the Linux username on the server (SSH + VNC).

So if you want to SSH as root in the browser, Cloudflare will typically try to log you in as the email prefix (e.g., maddox@… → Linux user maddox). That means:

Option A (cleanest): make your Access identity prefix root

Create/use an identity like root@yourdomain (or an alias) in your IdP and allow that user in the Access policy. Then Cloudflare’s email-prefix rule matches root.

Option B (recommended in practice): browser-login as your user, then become root

Ensure a Linux user exists matching your email prefix (e.g., maddox)

Give it sudo

After you connect in the browser: sudo -i

This avoids enabling direct remote root auth and works with Cloudflare’s constraint.

If you insist on direct root without Option A, you’re fighting the browser-rendered model’s username mapping. Cloudflare itself documents the email-prefix requirement.

Part 1 — Cloudflare Dashboard setup (on your laptop)

1. Create a Tunnel (dashboard-managed)

In Cloudflare Zero Trust, create a new Tunnel and pick the “connector” install method (you’ll copy a command that includes a tunnel token). Cloudflare’s API/CLI docs show the standard pattern is:

sudo cloudflared service install <TUNNEL_TOKEN>

2. Add the SSH public hostname route

Inside the Tunnel config, add a Public Hostname:

Hostname: ssh2.maddox.page

Service type: SSH

URL: localhost:22

This publishes SSH through that hostname without opening inbound ports to your server.

3. Protect it with Cloudflare Access + enable browser rendering

Create an Access application for ssh2.maddox.page and add an Allow policy for your identity.

Then enable Browser rendering: SSH for that application (this is the switch that gives you the web terminal).

Notes/limits to expect:

Browser rendering applies to Self-hosted public applications (your hostname)

For browser-rendered apps, Access policies are Allow/Block only (no bypass/service-auth on those apps)

Username mapping constraint (email prefix == unix username)

Part 2 — Fedora ARM64 server setup (run as root) 0) Pre-reqs checklist

sshd installed & running

SSH listens on localhost:22 (or adjust the Tunnel route accordingly)

Outbound connectivity to Cloudflare Tunnel endpoints (Cloudflare recommends doing connectivity pre-checks; tunnels use outbound connectivity on port 7844)

1. Install cloudflared on Fedora (RPM-based)

Cloudflare’s official package repo for RPM-based distros uses a repo file you add via dnf.

On Fedora:

sudo dnf -y install dnf-plugins-core
sudo dnf config-manager --add-repo https://pkg.cloudflare.com/cloudflared.repo
sudo dnf -y install cloudflared
cloudflared --version

(Cloudflare also notes a package-signing key rollover for RPM-based distros—so using the current repo config matters.)

2. Install the Tunnel connector as a system service (recommended)

From the Tunnel “Install connector” screen in Cloudflare Zero Trust, you’ll have a command equivalent to:

sudo cloudflared service install <TUNNEL_TOKEN>

That’s the documented pattern for installing the connector as a service.

Then start/verify:

sudo systemctl start cloudflared
sudo systemctl status cloudflared

Cloudflare’s docs describe running cloudflared as a Linux service using systemd.

3. Confirm the Tunnel is “Connected”

Back in the Cloudflare dashboard, your tunnel status should show connected.

If it’s connected but browser SSH fails, jump to Troubleshooting below.

Part 3 — Make it work with “root” the right way
Option B (recommended): login as your user, then sudo to root

Create the Linux user that matches your Access email prefix (example: prefix maddox):

sudo useradd -m -s /bin/bash maddox
sudo passwd -l maddox # optional: lock password if you’ll rely on other auth
sudo usermod -aG wheel maddox

Ensure Fedora allows wheel sudo (commonly already set):

/etc/sudoers should include something like: %wheel ALL=(ALL) ALL

In the browser terminal after login:

sudo -i

This respects Cloudflare’s browser-rendered username rule.

Option A: direct browser login as root

Only do this if you can make your Access identity prefix be root (like root@maddox.page). Cloudflare’s browser rendering requires that match.

Part 4 — Use it from your laptop (browser)

Open a browser (incognito is nice for testing)

Go to: https://ssh2.maddox.page

Authenticate with Cloudflare Access

You should drop into a terminal session on your Fedora box

Troubleshooting (the stuff that actually breaks in real life)

1. It logs me in as the wrong user / can’t do root

That’s the email prefix == linux username rule for browser rendering.
Use Option B (sudo) or create a root@… identity (Option A).

2. Black screen / handshake errors in browser terminal

Cloudflare documents that browser-rendered SSH supports specific key exchange algorithms:

curve25519-sha256

ecdh-sha2-nistp256

ecdh-sha2-nistp384

ecdh-sha2-nistp521

If your sshd is locked to older KEX/ciphers, loosen it to include one of those.

3. Tunnel is connected but SSH route fails

Re-check the tunnel route:

Service type SSH

Target localhost:22 (or the real sshd host:port)

And confirm sshd is listening:

sudo ss -tulpn | grep :22

4. Service won’t start / config confusion

If you go the locally-managed config route, Cloudflare’s Linux service docs say the service expects a config.yml containing (at minimum) tunnel: and credentials-file:.
But if you used the token install, the systemd unit typically runs cloudflared ... run --token ... (Cloudflare shows editing the systemd ExecStart for parameters).

5. Network egress blocked

Cloudflare recommends connectivity pre-checks; tunnels need outbound connectivity (notably to port 7844).

Optional: If you ever give up on “browser” and want true root control

Cloudflare’s Access for Infrastructure lets you explicitly allow SSH usernames like root in policy (“SSH user: … root …”)—but that approach is meant for SSH clients + WARP, not the browser terminal.

If you tell me what your Access login email is (just the prefix, like maddox), I can tailor the exact Linux user/sudo commands and the cleanest way to get you a “root experience” in the browser without weakening SSH security.

Solutions (try in order):

Option 1: Switch firewalld to iptables backend

sudo sed -i 's/FirewallBackend=nftables/FirewallBackend=iptables/' /etc/firewalld/firewalld.conf
sudo systemctl restart firewalld
sudo systemctl restart docker

Option 2: If you have Docker 29+, enable native nftables support

Edit /etc/docker/daemon.json:
{
"firewall-backend": "nftables"
}
Then restart Docker:
sudo systemctl restart docker

Option 3: Use Podman instead

Podman handles both iptables and nftables properly on Fedora:
sudo podman-compose -f docker-compose.pod.yml up

Quick test to confirm this is the issue:

# Temporarily disable firewalld

sudo systemctl stop firewalld
sudo systemctl restart docker
sudo docker-compose -f docker-compose.pod.yml up

If it works with firewalld stopped, then Option 1 or 2 is your fix.
