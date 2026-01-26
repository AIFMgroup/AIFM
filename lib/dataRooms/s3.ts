import { S3Client } from '@aws-sdk/client-s3';

export const S3_BUCKET = process.env.DATAROOM_S3_BUCKET || 'aifm-datarooms';
export const S3_REGION = process.env.AWS_REGION || 'eu-north-1';

// Shared S3 client for Data Rooms
export const s3Client = new S3Client({
  region: S3_REGION,
});



