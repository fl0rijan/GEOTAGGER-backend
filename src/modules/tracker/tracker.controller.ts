import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { TrackerService } from './tracker.service';
import { CreateActionLogDto } from './dto/create-action-log.dto';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { AdminGuard } from '../../common/guards/admin.guard';
import { IsOptionalAuth } from '../auth/decorators/is-optional.decorator';

@ApiTags('Tracker')
@Controller('tracker')
export class TrackerController {
  constructor(private readonly trackerService: TrackerService) {}

  @Post()
  @IsOptionalAuth()
  async logAction(
    @Body() dto: CreateActionLogDto,
    @GetUser('id') userId: string,
  ) {
    return this.trackerService.create(userId, dto);
  }

  @Get('admin/logs')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'ADMIN ONLY: View last 100 tracking logs' })
  async getLogs() {
    return this.trackerService.findLast100();
  }
}
