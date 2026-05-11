import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { Server } from 'http';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanDatabase, getAuthData } from './test-utils';
import { UploadsService } from '../src/modules/uploads/uploads.service';
import { GuessResultResponseDto } from '../src/modules/locations/dto/responses/guess-result.response.dto';

describe('Locations Game Logic', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;

  const uploadsServiceMock = {
    uploadMultiple: jest
      .fn()
      .mockResolvedValue([
        'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Test-Logo.svg/960px-Test-Logo.svg.png?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=thumbnail',
      ]),
  };

  const api = () => request(app.getHttpServer() as Server);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(UploadsService)
      .useValue(uploadsServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    const auth = await getAuthData(app, 'player@test.com', 'Password123!');
    authToken = auth.accessToken;
    userId = auth.userId;
  });

  describe('POST /location', () => {
    it('should create a location and add 10 points', async () => {
      await api()
        .post('/location')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          imageUrl: 'https://s3.test.com/image.jpg',
          latitude: 46.0569,
          longitude: 14.5058,
          name: 'Ljubljana Castle',
        })
        .expect(201);

      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.gamePoints).toBe(20);
    });
  });

  describe('POST /location/guess/:id', () => {
    it('should remove 1 point on first attempt and return distance', async () => {
      const loc = await prisma.location.create({
        data: {
          imageUrl: 'url',
          latitude: 46.0,
          longitude: 14.0,
          userId: (
            await prisma.user.create({
              data: {
                email: 'other@t.com',
                password: '...',
                firstName: 'a',
                lastName: 'b',
              },
            })
          ).id,
        },
      });

      const res = await api()
        .post(`/location/guess/${loc.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ latitude: 46.1, longitude: 14.1 })
        .expect(201);

      const { distanceMeters, pointsDeducted } =
        res.body as GuessResultResponseDto;

      expect(distanceMeters).toBeDefined();
      expect(pointsDeducted).toBe(1);

      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.gamePoints).toBe(9);
    });

    it('should reveal coordinates on 3rd attempt', async () => {
      const otherUser = await prisma.user.create({
        data: {
          email: 'o@t.com',
          password: '...',
          firstName: 'a',
          lastName: 'b',
        },
      });
      const loc = await prisma.location.create({
        data: {
          imageUrl: 'url',
          latitude: 46.0,
          longitude: 14.0,
          userId: otherUser.id,
        },
      });

      await api()
        .post(`/location/guess/${loc.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ latitude: 1, longitude: 1 });
      await api()
        .post(`/location/guess/${loc.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ latitude: 1, longitude: 1 });

      const res = await api()
        .post(`/location/guess/${loc.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ latitude: 1, longitude: 1 })
        .expect(201);

      const { actualLatitude, pointsDeducted } =
        res.body as GuessResultResponseDto;

      expect(actualLatitude).toBe(46.0);
      expect(pointsDeducted).toBe(3);
    });

    it('should not allow guessing own location', async () => {
      const loc = await prisma.location.create({
        data: {
          imageUrl: 'url',
          latitude: 46.0,
          longitude: 14.0,
          userId: userId,
        },
      });

      return api()
        .post(`/location/guess/${loc.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ latitude: 46.1, longitude: 14.1 })
        .expect(403);
    });
  });
});
