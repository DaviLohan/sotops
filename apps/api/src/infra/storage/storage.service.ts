import type { Readable } from 'node:stream';
import {
  BucketAlreadyOwnedByYou,
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchBucket,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.js';

export interface StoredObject {
  body: Readable;
  contentType: string;
  contentLength?: number;
}

/**
 * Armazenamento de arquivos no MinIO (S3). Os objetos são privados: o portal os recebe pela
 * própria API (`/media/...`), o que mantém o CSP em `img-src 'self'` e deixa o controle de
 * acesso no backend.
 */
@Injectable()
export class StorageService implements OnModuleDestroy {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: AppConfig) {
    this.bucket = config.storage.bucket;
    this.client = new S3Client({
      endpoint: config.storage.endpoint,
      region: config.storage.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.storage.accessKey,
        secretAccessKey: config.storage.secretKey,
      },
    });
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });
    try {
      await this.client.send(command);
    } catch (error) {
      // O bucket nasce no primeiro envio, e não na subida: a API sobe mesmo com o MinIO fora
      // (o readiness denuncia) e se recupera sozinha quando ele volta.
      if (!(error instanceof NoSuchBucket)) {
        throw error;
      }
      await this.createBucket();
      await this.client.send(command);
    }
  }

  private async createBucket(): Promise<void> {
    try {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Bucket ${this.bucket} criado.`);
    } catch (error) {
      // Outra instância pode ter criado o bucket no mesmo instante.
      if (!(error instanceof BucketAlreadyOwnedByYou)) {
        throw error;
      }
    }
  }

  /** `null` quando o objeto não existe. */
  async get(key: string): Promise<StoredObject | null> {
    try {
      const object = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        body: object.Body as Readable,
        contentType: object.ContentType ?? 'application/octet-stream',
        contentLength: object.ContentLength,
      };
    } catch (error) {
      if (error instanceof NoSuchKey || error instanceof NoSuchBucket) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Remove um objeto que deixou de ser referenciado. Falha aqui não desfaz a operação de
   * negócio já confirmada: fica no log, e o objeto órfão não é exposto por ninguém.
   */
  async deleteQuietly(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (error) {
      this.logger.warn(`Objeto ${key} não pôde ser removido: ${String(error)}`);
    }
  }
}
