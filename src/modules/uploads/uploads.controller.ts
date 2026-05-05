import {
  Controller,
  HttpStatus,
  ParseFilePipeBuilder,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UploadsService } from './uploads.service';
import { UploadImagesDto } from './dto/upload-images.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('images')
  @Throttle({ default: { limit: 2, ttl: 60000 } })
  @ApiOperation({ summary: 'Upload image for location' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadImagesDto })
  @UseInterceptors(
    FilesInterceptor('images', 1, {
      storage: multer.memoryStorage(),
    }),
  )
  @ApiCreatedResponse({
    description: 'The image have been successfully uploaded.',
    type: [String],
  })
  uploadImage(
    @UploadedFiles(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ })
        .addMaxSizeValidator({ maxSize: 2 * 1024 * 1024 })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    files: Array<Express.Multer.File>,
  ) {
    return this.uploadsService.uploadMultiple(files);
  }
}
