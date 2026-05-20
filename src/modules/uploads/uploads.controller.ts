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
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UploadsService } from './uploads.service';
import { UploadImagesDto } from './dto/upload-images.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { Throttle } from '@nestjs/throttler';
import { UploadResponseDto } from './dto/upload-response.dto';

@ApiTags('Uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('images')
  @Throttle({ default: { limit: 2, ttl: 60000 } })
  @ApiOperation({ summary: 'Upload image for location' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('images', 1, {
      storage: multer.memoryStorage(),
    }),
  )
  @ApiCreatedResponse({
    description: 'The image have been successfully uploaded.',
    type: [String],
  })
  @ApiBody({ type: UploadImagesDto })
  @ApiOkResponse({ type: UploadResponseDto })
  async uploadImage(
    @UploadedFiles(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ })
        .addMaxSizeValidator({ maxSize: 2 * 1024 * 1024 })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    files: Array<Express.Multer.File>,
  ) {
    const urls = await this.uploadsService.uploadMultiple(files);
    return { images: urls };
  }
}
