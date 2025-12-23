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
  -v redroid-base:/data \
  redroid/redroid:12.0.0_64only-latest \
  androidboot.redroid_width=720 \
  androidboot.redroid_height=1280 \
  androidboot.redroid_dpi=320
```

### 3. Connect and configure

Use scrcpy or adb to connect and install apps:

```bash
# Connect via adb
adb connect localhost:5555

# Install apps
adb install your-app.apk
```

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

### 6. Import from tar.gz (on another machine)

```bash
docker volume create redroid-base
docker run --rm -v redroid-base:/data -v $(pwd):/backup alpine \
  tar -xzvf /backup/redroid-base.tar.gz -C /data
```

## Notes

- The overlay filesystem (`androidboot.use_redroid_overlayfs=1`) ensures changes during runtime are stored in tmpfs and discarded on restart
- Each pod starts fresh from the golden base state
- To update the golden image, repeat this process with a new base volume
