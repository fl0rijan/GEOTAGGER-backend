import { Module } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { LocationsController } from './locations.controller';
import { UploadsService } from '../uploads/uploads.service';

@Module({
  controllers: [LocationsController],
  providers: [LocationsService, UploadsService],
})
export class LocationsModule {}
