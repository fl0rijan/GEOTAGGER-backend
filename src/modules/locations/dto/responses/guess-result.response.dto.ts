import { ApiProperty } from '@nestjs/swagger';

export class GuessResultResponseDto {
  @ApiProperty({
    description: 'Distance from the target in meters',
    example: 1250,
  })
  distanceMeters: number;

  @ApiProperty({
    description: 'How many points were removed from user',
    example: 1,
  })
  pointsDeducted: number;

  @ApiProperty({
    description: 'Current attempt number for this location',
    example: 1,
  })
  attemptNumber: number;

  @ApiProperty({ description: 'User balance after this guess', example: 9 })
  remainingPoints: number;

  @ApiProperty({ example: 46.0569, required: false })
  actualLatitude?: number;

  @ApiProperty({ example: 14.5058, required: false })
  actualLongitude?: number;

  @ApiProperty({ description: 'City center', required: false })
  locationName?: string;
}
