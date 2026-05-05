import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { extname } from 'path';

@Injectable()
export class UploadsService {
  private s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly logger = new Logger(UploadsService.name);

  constructor(private readonly config: ConfigService) {
    this.region = this.config.getOrThrow<string>('AWS_REGION');
    this.bucketName = this.config.getOrThrow<string>('AWS_S3_BUCKET_NAME');

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.config.getOrThrow<string>(
          'AWS_SECRET_ACCESS_KEY',
        ),
      },
    });
  }

  async uploadMultiple(files: Express.Multer.File[]): Promise<string[]> {
    try {
      const uploadPromises = files.map(async (file) => {
        const fileExt = extname(file.originalname);
        const fileName = `${randomUUID()}${fileExt}`;

        const command = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: fileName,
          Body: file.buffer,
          ContentType: file.mimetype,
        });

        await this.s3Client.send(command);

        return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${fileName}`;
      });

      return await Promise.all(uploadPromises);
    } catch (err) {
      this.logger.error('AWS S3 upload error', err);
      throw new InternalServerErrorException(
        'Failed to upload images to AWS S3',
      );
    }
  }
}
