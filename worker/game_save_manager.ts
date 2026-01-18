import {
  downloadGameSave,
  uploadGameSave,
  gameSaveExists,
} from "./r2_client.js";
import {
  extractToVolume,
  createVolumeSnapshot,
  clearDiffVolume,
} from "./volume_manager.js";

/**
 * Initialize session with game save restore
 * Called before starting redroid for a new session
 */
export async function initializeWithGameSave(userId: string): Promise<void> {
  console.log(`Initializing game save for user: ${userId}`);

  // Always clear volume first - ensures fresh slate even if restore fails
  await clearDiffVolume();

  // Check if user has an existing save
  const hasSave = await gameSaveExists(userId);

  if (hasSave) {
    console.log(`Found existing game save for user ${userId}, restoring...`);

    // Download the save
    const saveStream = await downloadGameSave(userId);
    if (saveStream) {
      // Extract to the diff volume (overwrites the cleared volume)
      await extractToVolume(saveStream);
      console.log(`Game save restored for user ${userId}`);
    } else {
      console.log(`Save existed but download failed, starting fresh`);
    }
  } else {
    console.log(`No existing save for user ${userId}, starting fresh`);
  }
}

/**
 * Save the current session state to R2
 * Called when session ends
 */
export async function saveGameState(userId: string): Promise<void> {
  console.log(`Saving game state for user: ${userId}`);

  try {
    // Create snapshot of the diff volume
    const snapshotBuffer = await createVolumeSnapshot();

    // Upload to R2
    await uploadGameSave(userId, snapshotBuffer);

    console.log(`Game state saved for user ${userId}`);
  } catch (err) {
    console.error(`Failed to save game state for user ${userId}:`, err);
    // Don't throw - save failure shouldn't crash the worker
  }
}
