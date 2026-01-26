import crypto from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const REGION = process.env.AWS_REGION || 'eu-north-1';

// Prefer a dedicated bucket if provided, otherwise reuse dataroom bucket (already provisioned).
const BUCKET =
  process.env.AVATAR_S3_BUCKET ||
  process.env.DATAROOM_S3_BUCKET ||
  'aifm-datarooms';

const s3 = new S3Client({ region: REGION });

function safeFileName(name: string): string {
  // Keep extension, strip path, and remove weird chars
  const base = name.split('/').pop()?.split('\\').pop() || 'avatar';
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
}

export function makeAvatarKey(sub: string, originalFileName: string): string {
  const fname = safeFileName(originalFileName);
  const id = crypto.randomUUID();
  return `avatars/${sub}/${id}-${fname}`;
}

export async function putAvatarObject(params: {
  key: string;
  contentType: string;
  body: Buffer;
}): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      // Keep private (default); served via API route.
    })
  );
}

export async function getAvatarObject(key: string) {
  return await s3.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
}

export async function deleteAvatarObject(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
}


