import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  readonly email: string;

  @ApiProperty({ default: 'password123' })
  @IsString()
  @IsNotEmpty()
  readonly password: string;
}
