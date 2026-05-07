import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdatePasswordDto {
  @ApiProperty({ default: 'password123' })
  @IsString()
  @IsOptional()
  readonly currentPassword?: string;

  @ApiProperty({ default: 'password1234' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  readonly newPassword: string;
}
