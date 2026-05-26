import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { LocationsService } from './locations.service';
import {
  CreateLocationDto,
  GuessLocationDto,
} from './dto/location-request.dto';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { PaginatedLocationResponseDto } from './dto/responses/paginated-location.response.dto';
import { GuessResultResponseDto } from './dto/responses/guess-result.response.dto';
import { LocationResponseDto } from './dto/responses/location.response.dto';
import { IsOptionalAuth } from '../auth/decorators/is-optional.decorator';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('Locations')
@Controller('location')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new location' })
  async create(@GetUser('id') userId: string, @Body() dto: CreateLocationDto) {
    return this.locationsService.createLocation(userId, dto);
  }

  @Get('guessed')
  @ApiOperation({ summary: 'Get list of guessed locations' })
  @IsOptionalAuth()
  @ApiOkResponse({ type: PaginatedLocationResponseDto })
  @SkipThrottle()
  async findAllGuessed(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @GetUser('id') userId: string,
  ) {
    return this.locationsService.findAllGuessed(userId, +page, +limit);
  }

  @Get()
  @ApiOperation({ summary: 'Get list of locations' })
  @IsOptionalAuth()
  @ApiOkResponse({ type: PaginatedLocationResponseDto })
  @SkipThrottle()
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.locationsService.findAll(+page, +limit);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get my added locations' })
  @ApiOkResponse({ type: PaginatedLocationResponseDto })
  async findMyUploaded(
    @GetUser('id') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.locationsService.findMyUploaded(userId, +page, +limit);
  }

  @Get('guesses/me')
  @ApiOperation({ summary: 'Get my best guessed locations' })
  @ApiOkResponse({ type: PaginatedLocationResponseDto })
  async getMyGuesses(
    @GetUser('id') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.locationsService.getMyGuessHistory(userId, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a location by id' })
  @ApiOkResponse({ type: LocationResponseDto })
  async findOne(@Param('id') id: string, @GetUser('id') userId: string) {
    return this.locationsService.findOne(id, userId);
  }

  @Get('random')
  @ApiOperation({ summary: 'Get a random location' })
  @ApiOkResponse({ type: LocationResponseDto })
  async getRandom(@GetUser('id') userId: string) {
    return this.locationsService.getRandom(userId);
  }

  @Post('guess/:id')
  @ApiOperation({ summary: 'Guess the location' })
  @ApiOkResponse({ type: GuessResultResponseDto })
  async guess(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @Body() dto: GuessLocationDto,
  ) {
    return this.locationsService.placeGuess(id, userId, dto);
  }
}
