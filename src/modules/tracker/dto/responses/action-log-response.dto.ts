import { ApiProperty } from '@nestjs/swagger';
import { ActionType } from '@prisma/client';

class LogUserDto {
  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  image: string;
}

export class ActionLogResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: ActionType })
  action: ActionType;

  @ApiProperty({ required: false, nullable: true })
  componentType: string | null;

  @ApiProperty({ required: false, nullable: true })
  newValue: string | null;

  @ApiProperty()
  url: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: LogUserDto, required: false, nullable: true })
  user: LogUserDto | null;
}
