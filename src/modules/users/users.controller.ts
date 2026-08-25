import { Controller, Body, Patch } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserResponseDto } from './dto/user-response.dto';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Users')
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me')
  @Throttle({ default: { limit: 4, ttl: 60000 } })
  @ApiOperation({ summary: 'Update your own profile information' })
  @ApiOkResponse({ type: UserResponseDto })
  async updateProfile(
    @GetUser('id') userId: string,
    @Body() updateProfileDto: UpdateUserDto,
  ) {
    await this.usersService.update(userId, updateProfileDto);

    return {
      data: [],
      message: 'Successfully updated profile information',
    };
  }
}
