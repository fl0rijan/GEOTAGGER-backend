import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateLocationDto,
  GuessLocationDto,
} from './dto/location-request.dto';
import { LocationResponseDto } from './dto/responses/location.response.dto';
import { GuessResultResponseDto } from './dto/responses/guess-result.response.dto';

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService) {}

  async createLocation(userId: string, dto: CreateLocationDto) {
    return this.prisma.$transaction(async (tx) => {
      const location = await tx.location.create({
        data: {
          ...dto,
          userId,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { gamePoints: { increment: 10 } },
      });

      return location;
    });
  }

  async findAll(userId: string | null, page: number = 1, limit: number = 10) {
    const take = limit;
    const skip = (page - 1) * limit;

    const [locations, totalItems] = await Promise.all([
      this.prisma.location.findMany({
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { firstName: true } },
          guesses: userId
            ? {
                where: { userId },
                orderBy: { errorDistance: 'asc' },
                take: 1,
              }
            : false,
        },
      }),
      this.prisma.location.count(),
    ]);

    const sanitizedData = locations.map((loc) => {
      const bestGuess =
        loc.guesses && loc.guesses.length > 0 ? loc.guesses[0] : null;

      return {
        id: loc.id,
        imageUrl: loc.imageUrl,
        uploadedBy: loc.user.firstName,
        createdAt: loc.createdAt,
        userGuessDistance: bestGuess
          ? Math.round(bestGuess.errorDistance)
          : null,
      };
    });

    return {
      data: sanitizedData,
      meta: {
        totalItems,
        currentPage: page,
        itemsPerPage: take,
        totalPages: Math.ceil(totalItems / take),
      },
    };
  }

  async findOne(id: string, userId: string): Promise<LocationResponseDto> {
    const location = await this.prisma.location.findUnique({
      where: { id },
      include: { user: { select: { firstName: true } } },
    });

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    const guessCount = await this.prisma.guess.count({
      where: { userId, id },
    });

    const isRevealed = guessCount >= 3 || location.userId === userId;

    return {
      id: location.id,
      imageUrl: location.imageUrl,
      uploadedBy: location.user.firstName,
      createdAt: location.createdAt,
      ...(isRevealed && {
        latitude: location.latitude,
        longitude: location.longitude,
        name: location.name || 'Location name is not available.',
      }),
    };
  }

  async getRandom(userId: string): Promise<LocationResponseDto> {
    const userGuesses = await this.prisma.guess.findMany({
      where: { userId },
      select: { locationId: true },
      distinct: ['locationId'],
    });

    const alreadyGuessedIds = userGuesses.map((g) => g.locationId);

    const count = await this.prisma.location.count({
      where: {
        id: { notIn: alreadyGuessedIds },
        userId: { not: userId },
      },
    });
    if (count === 0) {
      throw new NotFoundException(
        'No locations available to guess yet. Be the first to upload!',
      );
    }

    const skip = Math.floor(Math.random() * count);

    const location = await this.prisma.location.findFirst({
      where: {
        id: { notIn: alreadyGuessedIds },
        userId: { not: userId },
      },
      skip,
      include: { user: { select: { firstName: true } } },
    });

    if (!location) {
      throw new NotFoundException(
        'Failed to retrieve a random location. Please try again.',
      );
    }

    return {
      id: location.id,
      imageUrl: location.imageUrl,
      uploadedBy: location.user.firstName,
      createdAt: location.createdAt,
    };
  }

  async findMyUploaded(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.location.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.location.count({ where: { userId } }),
    ]);

    return { data, meta: { total, page, lastPage: Math.ceil(total / limit) } };
  }

  async getMyGuessHistory(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.guess.findMany({
        where: { userId },
        skip,
        take: limit,
        include: {
          location: {
            select: { imageUrl: true },
          },
        },
        orderBy: { errorDistance: 'asc' },
      }),
      this.prisma.guess.count({ where: { userId } }),
    ]);

    return { data, meta: { total, page, lastPage: Math.ceil(total / limit) } };
  }

  async placeGuess(
    locationId: string,
    userId: string,
    dto: GuessLocationDto,
  ): Promise<GuessResultResponseDto> {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (user && user.id === location.userId) {
      throw new ForbiddenException(
        'You are not allowed to guess on your own location',
      );
    }

    if (!user || user.gamePoints <= 0) {
      throw new NotFoundException('You do not have enough points to play');
    }

    try {
      return this.prisma.$transaction(async (tx) => {
        const prevGuesses = await tx.guess.count({
          where: { userId, locationId },
        });

        const attemptNumber = prevGuesses + 1;
        let pointsToLose = 3;
        if (attemptNumber === 1) pointsToLose = 1;
        if (attemptNumber === 2) pointsToLose = 2;

        if (user.gamePoints < pointsToLose) {
          throw new BadRequestException(
            `Not enough points for attempt #${attemptNumber}`,
          );
        }

        const result = await tx.$queryRaw<[{ distance: number }]>`
      SELECT ST_DistanceSphere(
        ST_MakePoint(${dto.longitude}::float, ${dto.latitude}::float),
        ST_MakePoint(${location.longitude}::float, ${location.latitude}::float)
      ) as distance`;

        const errorDistance = result[0].distance;

        await tx.guess.create({
          data: {
            guessedLat: dto.latitude,
            guessedLng: dto.longitude,
            errorDistance,
            pointsLost: pointsToLose,
            attemptNumber,
            userId,
            locationId,
          },
        });
        await tx.user.update({
          where: { id: userId },
          data: { gamePoints: { decrement: pointsToLose } },
        });

        const isRevealTime = attemptNumber >= 3;

        return {
          distanceMeters: Math.round(errorDistance),
          pointsDeducted: pointsToLose,
          attemptNumber: attemptNumber,
          remainingPoints: user.gamePoints,
          ...(isRevealTime && {
            actualLatitude: location.latitude,
            actualLongitude: location.longitude,
            locationName: location.name || 'Location name is not available.',
          }),
        };
      });
    } catch {
      throw new InternalServerErrorException(
        'We encountered a problem saving your guess. Please try again.',
      );
    }
  }
}
