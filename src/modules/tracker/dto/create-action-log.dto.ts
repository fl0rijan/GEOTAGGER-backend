import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ActionType } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class CreateActionLogDto {
  @ApiProperty({ enum: ActionType })
  @IsEnum(ActionType)
  @IsNotEmpty()
  action: ActionType;

  @IsString()
  @IsOptional()
  componentType?: string | null;

  @IsString()
  @IsOptional()
  newValue?: string;

  @IsString()
  @IsNotEmpty()
  url: string;
}
