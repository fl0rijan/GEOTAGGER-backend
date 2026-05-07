import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateActionLogDto } from './dto/create-action-log.dto';

@Injectable()
export class TrackerService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string | null, dto: CreateActionLogDto) {
    return this.prisma.actionLog.create({
      data: {
        ...dto,
        userId,
      },
    });
  }

  async findLast100() {
    return this.prisma.actionLog.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { firstName: true, lastName: true, image: true },
        },
      },
    });
  }
}
