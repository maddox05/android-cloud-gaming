import { exec } from "child_process";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { createWriteStream, createReadStream } from "fs";
import { unlink } from "fs/promises";
import { redroidRunner } from "./redriod_runner.js";

const POD_NAME = process.env.POD_NAME!;

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

  // Use docker run with alpine to clear the volume contents
  await execAsync(
    `docker run --rm -v ${volumeName}:/data alpine sh -c "rm -rf /data/* /data/.[!.]* 2>/dev/null || true"`
  );
  console.log("Diff volume cleared");
}

/**
 * Extract a tarball stream into the diff volume
 * ASYNC to avoid blocking the event loop during WebRTC signaling.
 */
export async function extractToVolume(stream: Readable): Promise<void> {
  const volumeName = redroidRunner.getDiffVolumeName();
  const tempFile = `/tmp/game_save_${POD_NAME}.tar.gz`;

  console.log(`Extracting save to volume: ${volumeName}`);

  try {
    // Write stream to temp file first
    await pipeline(stream, createWriteStream(tempFile));

    // Clear existing diff data
    await clearDiffVolume();

    // Extract using docker + alpine (safer than host extraction)
    await execAsync(
      `docker run --rm -v ${volumeName}:/data -v ${tempFile}:/backup.tar.gz alpine sh -c "cd /data && tar xzf /backup.tar.gz"`
    );

    console.log("Game save extracted successfully");
  } finally {
    // Cleanup temp file
    try {
      await unlink(tempFile);
    } catch {
      // Ignore cleanup errors
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
  const tempFile = `/tmp/game_save_${POD_NAME}_out.tar.gz`;

  console.log(`Creating snapshot of volume: ${volumeName}`);

  try {
    // Create tarball using docker + alpine
    await execAsync(
      `docker run --rm -v ${volumeName}:/data -v /tmp:/backup alpine sh -c "cd /data && tar czf /backup/game_save_${POD_NAME}_out.tar.gz ."`
    );

    // Read the tarball into a buffer
    const chunks: Buffer[] = [];
    const readStream = createReadStream(tempFile);

    for await (const chunk of readStream) {
      chunks.push(Buffer.from(chunk));
    }

    console.log("Volume snapshot created");
    return Buffer.concat(chunks);
  } finally {
    // Cleanup temp file
    try {
      await unlink(tempFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}
