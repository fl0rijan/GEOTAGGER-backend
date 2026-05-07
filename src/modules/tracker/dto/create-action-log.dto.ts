import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ActionType } from '../../../../generated/prisma/enums';

export class CreateActionLogDto {
  @IsEnum(ActionType)
  action: ActionType;

  @IsString()
  @IsOptional()
  componentType?: string;

  @IsString()
  @IsOptional()
  newValue?: string;

  @IsString()
  @IsNotEmpty()
  url: string;
}
