import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class UpdatePasswordDto {
  @ApiProperty({ default: 'password123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  readonly currentPassword: string;

  @ApiProperty({ default: 'password1234' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  readonly newPassword: string;
}
