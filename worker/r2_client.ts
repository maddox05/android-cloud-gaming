import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";
import {
  PHONE_IMAGE_VERSION,
  R2_GAME_SAVES_PREFIX,
} from "../shared/const.js";

// Validate required env vars at module load - crash if missing
const REQUIRED_ENV_VARS = [
  "CLOUDFLARE_R2_ACCESS_KEY_ID",
  "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
  "CLOUDFLARE_R2_ENDPOINT",
  "R2_BUCKET_NAME",
];

for (const envVar of REQUIRED_ENV_VARS) {
  if (!process.env[envVar]) {
    console.error(`FATAL: Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;

const s3Client = new S3Client({
  region: "auto", // Cloudflare R2 uses "auto"
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

/**
 * Generate the R2 key for a user's game save
 */
export function getGameSaveKey(userId: string): string {
  return `${R2_GAME_SAVES_PREFIX}/${userId}_${PHONE_IMAGE_VERSION}.tar.gz`;
}

/**
 * Check if a game save exists for this user
 */
export async function gameSaveExists(userId: string): Promise<boolean> {
  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: getGameSaveKey(userId),
      })
    );
    return true;
  } catch (err: any) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw err;
  }
}

/**
 * Download game save from R2
 * Returns a readable stream or null if not found
 */
export async function downloadGameSave(
  userId: string
): Promise<Readable | null> {
  try {
    console.log(`Downloading game save for user ${userId}...`);
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: getGameSaveKey(userId),
      })
    );
    console.log(`Game save downloaded for user ${userId}`);
    return response.Body as Readable;
  } catch (err: any) {
    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
      console.log(`No game save found for user ${userId}`);
      return null;
    }
    throw err;
  }
}

/**
 * Upload game save to R2
 */
export async function uploadGameSave(
  userId: string,
  data: Buffer | Readable
): Promise<void> {
  console.log(`Uploading game save for user ${userId}...`);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: getGameSaveKey(userId),
      Body: data,
      ContentType: "application/gzip",
    })
  );
  console.log(`Game save uploaded for user ${userId}`);
}
