import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  type GetObjectCommandOutput,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { AppConfig } from '../config/app-config';

@Injectable()
export class StorageService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('Storage');
  readonly client: S3Client;
  readonly bucket: string;

  constructor(config: AppConfig) {
    const e = config.env;
    this.bucket = e.S3_BUCKET;
    this.client = new S3Client({
      region: e.S3_REGION,
      endpoint: e.S3_ENDPOINT,
      forcePathStyle: e.S3_FORCE_PATH_STYLE,
      credentials:
        e.S3_ACCESS_KEY && e.S3_SECRET_KEY ? { accessKeyId: e.S3_ACCESS_KEY, secretAccessKey: e.S3_SECRET_KEY } : undefined,
      // only checksum when the operation requires it — keeps MinIO / older S3 clones happy
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async onModuleInit() {
    await this.ensureBucket();
  }

  private async ensureBucket() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }), { abortSignal: AbortSignal.timeout(5_000) });
      this.logger.log(`Bucket "${this.bucket}" ready`);
      return;
    } catch {
      /* fall through to create */
    }
    try {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }), { abortSignal: AbortSignal.timeout(5_000) });
      this.logger.log(`Created bucket "${this.bucket}"`);
    } catch (e) {
      this.logger.warn(
        `Could not verify or create bucket "${this.bucket}" (${(e as Error).name}: ${(e as Error).message}). Uploads will fail until storage is reachable.`,
      );
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }), { abortSignal: AbortSignal.timeout(3_000) });
      return true;
    } catch {
      return false;
    }
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ContentLength: body.length,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  get(key: string, range?: string, ifNoneMatch?: string, signal?: AbortSignal): Promise<GetObjectCommandOutput> {
    return this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: range, IfNoneMatch: ifNoneMatch }),
      { abortSignal: signal },
    );
  }

  /** Best effort removal of every object under a prefix. */
  async deletePrefix(prefix: string): Promise<number> {
    let deleted = 0;
    let token: string | undefined;
    do {
      const list = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      const keys = (list.Contents ?? []).map((o) => ({ Key: o.Key! })).filter((o) => o.Key);
      if (keys.length) {
        await this.client.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys, Quiet: true } }));
        deleted += keys.length;
      }
      token = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (token);
    return deleted;
  }

  onApplicationShutdown() {
    this.client.destroy();
  }
}
