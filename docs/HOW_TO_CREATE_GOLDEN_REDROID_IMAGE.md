# How to Create a Golden Redroid Image

A golden image is a pre-configured redroid instance with apps and settings already installed.

## Steps

### 1. Create the base volume (if not exists)

```bash
docker volume create redroid-base
```

### 2. Start a temporary redroid container

```bash
docker run -d --name redroid-setup \
  --privileged \
  -p 5555:5555 \
  -v redroid-base:/data \
  redroid/redroid:12.0.0_64only-latest \
  androidboot.redroid_width=720 \
  androidboot.redroid_height=1280 \
```

### 3. Connect and configure

Use scrcpy or adb to connect and install apps:

```bash
# Connect via adb
adb connect localhost:5555

# Install apps
adb install your-app.apk
```

-- note anything you download with apkpure even after uninstall will leave residue files.

### 4. Stop the container

```bash
docker stop redroid-setup
docker rm redroid-setup
```

The `redroid-base` volume now contains your golden state and will be used by all pods via the overlay filesystem.

### 5. Export to tar.gz (optional)

```bash
docker run --rm -v redroid-base:/data -v $(pwd):/backup alpine \
  tar -czvf /backup/redroid-base.tar.gz -C /data .
```

### 6. Upload to Cloudflare R2 via S3 CLI

First, configure AWS CLI with your Cloudflare R2 credentials:

```bash
aws configure set aws_access_key_id <YOUR_R2_ACCESS_KEY_ID>
aws configure set aws_secret_access_key <YOUR_R2_SECRET_ACCESS_KEY>
aws configure set default.region auto
```

aws configure set aws_secret_access_key 8d8b33d1b7f9f6279b9eca7fa7ecfdf75aed5ffb6974f1b09bc05d665183a1be

Upload the tar.gz to your R2 bucket:

```bash
aws s3 cp redroid-base.tar.gz s3://android-cloud-gaming/redroid-bases/redroid-base.tar.gz \
  --endpoint-url https://7b692eb05e5322beaef098debe10e8ae.r2.cloudflarestorage.com
```

To make the file publicly accessible, ensure your bucket has public access enabled in the Cloudflare dashboard, or use a custom domain linked to your R2 bucket.

### 7. Download and Import via install.sh

On the target machine, delete the old tar.gz and volume, and run the worker install script.

```bash
./worker/install.sh
```

## Notes

- The overlay filesystem (`androidboot.use_redroid_overlayfs=1`) ensures changes during runtime are stored in tmpfs and discarded on restart
- Each pod starts fresh from the golden base state
- To update the golden image, repeat this process with a new base volume
