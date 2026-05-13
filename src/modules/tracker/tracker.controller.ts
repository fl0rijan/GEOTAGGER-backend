import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { TrackerService } from './tracker.service';
import { CreateActionLogDto } from './dto/create-action-log.dto';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { AdminGuard } from '../../common/guards/admin.guard';
import { IsOptionalAuth } from '../auth/decorators/is-optional.decorator';
import { SkipThrottle } from '@nestjs/throttler';
import { ActionLogResponseDto } from './dto/responses/action-log-response.dto';

@ApiTags('Tracker')
@Controller('tracker')
export class TrackerController {
  constructor(private readonly trackerService: TrackerService) {}

  @Post()
  @SkipThrottle()
  @IsOptionalAuth()
  async logAction(
    @Body() dto: CreateActionLogDto,
    @GetUser('id') userId: string,
  ) {
    return this.trackerService.create(userId, dto);
  }

  @Get('admin/logs')
  @SkipThrottle()
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: ActionLogResponseDto, isArray: true })
  @ApiOperation({ summary: 'ADMIN ONLY: View last 100 tracking logs' })
  async getLogs() {
    return this.trackerService.findLast100();
  }
}
