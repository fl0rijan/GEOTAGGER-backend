import { ApiProperty } from '@nestjs/swagger';

export class LocationResponseDto {
  @ApiProperty({ example: 'd558b09a-2941-496e-9fb5-168b09b06fdb' })
  id: string;

  @ApiProperty({ example: 'https://s3.amazon.com/bucket/image.jpg' })
  imageUrl: string;

  @ApiProperty({ example: 'Mitja' })
  uploadedBy: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ required: false })
  latitude?: number;

  @ApiProperty({ required: false })
  longitude?: number;

  @ApiProperty({ required: false })
  name?: string;

  @ApiProperty({ required: false })
  userGuessDistance?: number;
}
