import { exec } from "child_process";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { createWriteStream, createReadStream } from "fs";
import { unlink } from "fs/promises";
import { redroidRunner } from "./redriod_runner.js";
import { GAMES_LIST } from "../shared/const.js";

const WORKER_NAME = process.env.WORKER_NAME!;

/**
 * Promise wrapper for exec (non-blocking)
 */
function execAsync(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve(stdout.trim());
    });
  });
}

/**
 * Clear the diff volume contents (fresh state)
 * ASYNC to avoid blocking the event loop during WebRTC signaling.
 */
export async function clearDiffVolume(): Promise<void> {
  const volumeName = redroidRunner.getDiffVolumeName();
  console.log(`Clearing diff volume: ${volumeName}`);

  try {
    await execAsync(`docker volume rm ${volumeName}`);
  } catch (err) {
    console.warn(`Failed to remove volume ${volumeName}:`, err);
  }
  await execAsync(`docker volume create ${volumeName}`);
  console.log("Diff volume cleared");
}

/**
 * Clean the volume before saving - keeps only GAMES_LIST app data
 * Removes all other content and cleans cache/code_cache/update from game apps
 *
 * Volume structure after cleanup: /vol/upper/data/{app_id}/
 * Tar will contain: /upper/data/{app_id}/
 */
async function cleanVolumeForSave(): Promise<void> {
  const volumeName = redroidRunner.getDiffVolumeName();
  const allowedApps = GAMES_LIST.map((g) => g.id);

  console.log(`Cleaning volume ${volumeName} for save...`);

  // Step 1: Delete everything at root EXCEPT 'upper' directory
  try {
    await execAsync(
      `docker run --rm -v ${volumeName}:/vol alpine find /vol -mindepth 1 -maxdepth 1 ! -name upper -exec rm -rf {} +`,
    );
  } catch (err) {
    console.warn("Step 1 (clean root) warning:", err);
  }

  // Step 2: In /vol/upper, delete everything EXCEPT 'data' directory
  try {
    await execAsync(
      `docker run --rm -v ${volumeName}:/vol alpine find /vol/upper -mindepth 1 -maxdepth 1 ! -name data -exec rm -rf {} +`,
    );
  } catch (err) {
    console.warn("Step 2 (clean /upper) warning:", err);
  }

  // Step 3: In /vol/upper/data, delete all apps NOT in allowedApps
  try {
    const listResult = await execAsync(
      `docker run --rm -v ${volumeName}:/vol alpine ls /vol/upper/data 2>/dev/null || true`,
    );
    const existingApps = listResult.split("\n").filter(Boolean);

    for (const app of existingApps) {
      if (!allowedApps.includes(app)) {
        console.log(`Removing non-allowed app: ${app}`);
        await execAsync(
          `docker run --rm -v ${volumeName}:/vol alpine rm -rf /vol/upper/data/${app}`,
        );
      }
    }
  } catch (err) {
    console.warn("Step 3 (remove non-allowed apps) warning:", err);
  }

  // Step 4: For allowed apps, remove cache/code_cache/update
  for (const appId of allowedApps) {
    try {
      await execAsync(
        `docker run --rm -v ${volumeName}:/vol alpine rm -rf /vol/upper/data/${appId}/cache /vol/upper/data/${appId}/code_cache /vol/upper/data/${appId}/update`,
      );
    } catch {
      // Ignore errors - app may not exist
    }
  }

  console.log("Volume cleaned for save");
}

/**
 * Extract a tarball stream into the diff volume
 * ASYNC to avoid blocking the event loop during WebRTC signaling.
 */
export async function extractToVolume(stream: Readable): Promise<void> {
  const volumeName = redroidRunner.getDiffVolumeName();
  const tempFile = `/tmp/game_save_${WORKER_NAME}.tar.gz`;

  console.log(`Extracting save to volume: ${volumeName}`);

  try {
    // Write stream to temp file first
    await pipeline(stream, createWriteStream(tempFile));

    // Clear existing diff data
    await clearDiffVolume();

    // Mounts Docker volume & save data to a linux machine and extracts the game save in the DATA folder
    await execAsync(
      `docker run --rm -v ${volumeName}:/data -v ${tempFile}:/backup.tar.gz alpine sh -c "cd /data && tar xzf /backup.tar.gz"`,
    );

    console.log("Game save extracted successfully");
  } finally {
    try {
      await unlink(tempFile);
    } catch (err) {
      console.warn(`Failed to cleanup temp file ${tempFile}:`, err);
    }
  }
}

/**
 * Create a tarball of the diff volume
 * Returns a Buffer containing the gzipped tar
 * ASYNC to avoid blocking the event loop.
 */
export async function createVolumeSnapshot(): Promise<Buffer> {
  const volumeName = redroidRunner.getDiffVolumeName();
  const tempFile = `/tmp/game_save_${WORKER_NAME}_out.tar.gz`;

  console.log(`Creating snapshot of volume: ${volumeName}`);

  // Clean the volume first - only keep GAMES_LIST app data
  await cleanVolumeForSave();

  try {
    // Create tarball using docker + alpine
    // How this works:
    //   -v ${volumeName}:/data  -> mounts the Docker volume inside the container at /data
    //   -v /tmp:/backup         -> mounts host's /tmp folder inside the container at /backup
    //   tar czf /backup/...     -> writes tarball to /backup, which is actually host's /tmp
    // So the tarball ends up at /tmp on the host, accessible via tempFile
    await execAsync(
      `docker run --rm -v ${volumeName}:/data -v /tmp:/backup alpine sh -c "cd /data && tar czf /backup/game_save_${WORKER_NAME}_out.tar.gz ."`,
    );

    // Read the tarball (now on host at tempFile) into a buffer
    const chunks: Buffer[] = [];
    const readStream = createReadStream(tempFile);

    for await (const chunk of readStream) {
      chunks.push(Buffer.from(chunk));
    }

    console.log("Volume snapshot created");
    return Buffer.concat(chunks);
  } finally {
    try {
      await unlink(tempFile);
    } catch (err) {
      console.warn(`Failed to cleanup temp file ${tempFile}:`, err);
    }
  }
}
