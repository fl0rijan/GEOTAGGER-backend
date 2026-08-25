import { PartialType } from '@nestjs/swagger';
import { CreateLocationDto } from './location-request.dto';

export class UpdateLocationDto extends PartialType(CreateLocationDto) {}
