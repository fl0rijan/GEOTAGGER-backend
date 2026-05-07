import { ApiProperty } from '@nestjs/swagger';
import { LocationResponseDto } from './location.response.dto';

export class PaginationMetaDto {
  @ApiProperty({ example: 100 })
  totalItems: number;

  @ApiProperty({ example: 10 })
  itemCount: number;

  @ApiProperty({ example: 10 })
  itemsPerPage: number;

  @ApiProperty({ example: 10 })
  totalPages: number;

  @ApiProperty({ example: 1 })
  currentPage: number;
}

export class PaginatedLocationResponseDto {
  @ApiProperty({ type: [LocationResponseDto] })
  data: LocationResponseDto[];

  @ApiProperty()
  meta: PaginationMetaDto;
}
