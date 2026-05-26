import { ApiProperty } from '@nestjs/swagger';

export class LeaderboardEntryDto {
  @ApiProperty({ example: '615f409d-3588-45eb-b9c9-c5e8ccd66faa' })
  id: string;

  @ApiProperty({ example: '615f409d-3588-45eb-b9c9-c5e8ccd66faa' })
  userId: string;

  @ApiProperty({ example: 'Joe' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;

  @ApiProperty({
    example: 'https://s3.amazon.com/bucket/avatar.jpg',
    required: false,
    nullable: true,
  })
  image: string | null;

  @ApiProperty({ example: 124.5, description: 'Distance in meters' })
  errorDistance: number;

  @ApiProperty()
  createdAt: Date;
}
