# How to Create a Golden Redroid Image

A golden image is a pre-configured Redroid instance with apps and settings already installed. Each worker starts fresh from this base state using the overlay filesystem.

## Prerequisites

- Docker installed
- ADB installed
- AWS CLI configured (for R2 upload)
- [redroid-script](https://github.com/ayasa520/redroid-script) cloned

## Steps

### 1. Create the base volume

```bash
docker volume create redroid-base
```

### 2. Build Redroid image with LiteGapps and Magisk

Using the [redroid-script](https://github.com/ayasa520/redroid-script) tool:

```bash
python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt && python redroid.py -a 12.0.0_64only -lg -m
```

This creates a custom Redroid image with Google Play Services (LiteGapps) and Magisk for root access.

### 3. Start a temporary Redroid container

```bash
docker run -d --name redroid-setup \
  --privileged \
  -p 5555:5555 \
  -v redroid-base:/data \
  redroid/redroid:12.0.0_64only_litegapps_magisk \
  androidboot.redroid_width=720 \
  androidboot.redroid_height=1280
```

### 4. Connect and configure

Connect via ADB:

```bash
adb connect localhost:5555
```

Use `scrcpy` to view and interact with the device:

```bash
scrcpy -s localhost:5555
```

#### 4.1 Register device for Google Play certification

1. Go to https://www.google.com/android/uncertified
2. Follow the registration steps
3. Wait 5-10 minutes for certification to propagate
4. Log into Google Play to verify it works

#### 4.2 Configure Magisk

1. Launch Magisk app
2. Enable the Superuser setting
3. Restart the container:
   ```bash
   docker restart redroid-setup
   ```

#### 4.3 Configure kiosk mode

Set the Free Kiosk pin to match the `KIOSK_PIN` environment variable.

Other Settings need to be set as well!

#### 4.4 Install apps & Cache

Install apps using Google Play or APK files as needed.

Then Load up the apps and they will start caching data (for example clash of clans while you sit on the home screen caches about 1GB of assets)

### 5. Stop and remove the setup container

```bash
docker stop redroid-setup
docker rm redroid-setup
```

The `redroid-base` volume now contains your golden state.

### 6. Remove shared_prefs for all games

This fixes issues with games creating ghost accounts that can't be played simultaneously (e.g., Clash Royale).

```bash
docker run --rm -it -v redroid-base:/data alpine sh
```

Then run these commands inside the container:

```bash
rm -rf /data/data/com.supercell.clashroyale/shared_prefs && \
mkdir -p /data/data/com.supercell.clashroyale/shared_prefs && \
chmod 777 /data/data/com.supercell.clashroyale/shared_prefs

rm -rf /data/data/com.supercell.clashofclans/shared_prefs && \
mkdir -p /data/data/com.supercell.clashofclans/shared_prefs && \
chmod 777 /data/data/com.supercell.clashofclans/shared_prefs

rm -rf /data/data/youtube.lite.anikinc/shared_prefs && \
mkdir -p /data/data/youtube.lite.anikinc/shared_prefs && \
chmod 777 /data/data/youtube.lite.anikinc/shared_prefs

rm -rf /data/data/com.roblox.client/shared_prefs && \
mkdir -p /data/data/com.roblox.client/shared_prefs && \
chmod 777 /data/data/com.roblox.client/shared_prefs

rm -rf /data/data/com.tocaboca.tocalifeworld/shared_prefs && \
mkdir -p /data/data/com.tocaboca.tocalifeworld/shared_prefs && \
chmod 777 /data/data/com.tocaboca.tocalifeworld/shared_prefs

rm -rf /data/data/com.innersloth.spacemafia/shared_prefs && \
mkdir -p /data/data/com.innersloth.spacemafia/shared_prefs && \
chmod 777 /data/data/com.innersloth.spacemafia/shared_prefs

rm -rf /data/data/com.robtopx.geometryjumplite/shared_prefs && \
mkdir -p /data/data/com.robtopx.geometryjumplite/shared_prefs && \
chmod 777 /data/data/com.robtopx.geometryjumplite/shared_prefs

rm -rf /data/data/ALL_OTHER_APPS_WE_HAVE_I_NEED_TO_MAKE_A_SCRIPT_FOR_THIS_TODO

exit
```

### 7. Export to tar.gz

Replace `{VERSION}` with your version number (e.g., `1`, `2`, etc.):

```bash
docker run --rm -v redroid-base:/data -v $(pwd):/backup alpine \
  tar -czvf /backup/redroid-base_{VERSION}.tar.gz -C /data .
```

### 8. Upload to Cloudflare R2

Configure AWS CLI with R2 credentials:

```bash
aws configure set aws_access_key_id <YOUR_R2_ACCESS_KEY_ID>
aws configure set aws_secret_access_key <YOUR_R2_SECRET_ACCESS_KEY>
aws configure set default.region auto
```

Upload the archive (use the same `{VERSION}` as the export):

```bash
aws s3 cp redroid-base_{VERSION}.tar.gz s3://android-cloud-gaming/redroid-bases/redroid-base_{VERSION}.tar.gz \
  --endpoint-url https://7b692eb05e5322beaef098debe10e8ae.r2.cloudflarestorage.com
```

### 9. Deploy to target machines

On each target machine, delete any existing volume and run the install script. The script will prompt for the `REDROID_BASE_IMAGE_VERSION` to download:

```bash
./worker/install.sh
# Enter the REDROID_BASE_IMAGE_VERSION when prompted
```

## Important Notes

- **Overlay filesystem**: The `androidboot.use_redroid_overlayfs=1` flag ensures runtime changes are stored in tmpfs and discarded on restart
- **APKPure residue**: Apps installed via APKPure may leave residual files even after uninstall
- **Version conflicts**: When testing overlay filesystem, set `REDROID_BASE_IMAGE_VERSION` in `shared/const.ts` to a high number to avoid conflicts with old save data. On prod, make sure the correct value is set to match the base image version. Or even better delete any old save you had
- **Updating the image**: To update the golden image, repeat this entire process with a fresh base volume
