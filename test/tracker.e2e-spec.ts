import { ActionType } from '@prisma/client';
import request from 'supertest';
import { Server } from 'http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanDatabase, getAuthData } from './test-utils';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import * as bcrypt from 'bcrypt';
import { TokenResponse } from '../src/modules/auth/dto/token-response.dto';

describe('Tracker and Admin', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer() as Server);

  it('should log an anonymous action', async () => {
    return api()
      .post('/tracker')
      .send({
        action: ActionType.CLICK,
        componentType: 'button',
        url: 'http://localhost/home',
      })
      .expect(201);
  });

  it('should log an logined users action', async () => {
    const auth = await getAuthData(app, 'user@test.com');

    return api()
      .post('/tracker')
      .send({
        action: ActionType.SCROLL,
        componentType: 'homepage',
        url: 'http://localhost/home',
      })
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(201);
  });

  it('should block non admins from logs', async () => {
    const auth = await getAuthData(app, 'user@test.com');

    return api()
      .get('/tracker/admin/logs')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(403);
  });

  it('should allow admin to view last 100 logs', async () => {
    const rawPassword = 'Password123!';
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    await prisma.user.create({
      data: {
        email: 'admin@test.com',
        password: hashedPassword,
        isAdmin: true,
        firstName: 'a',
        lastName: 'b',
      },
    });

    const login = await api()
      .post('/login')
      .send({ email: 'admin@test.com', password: rawPassword });

    const { accessToken } = login.body as TokenResponse;

    const res = await api()
      .get('/tracker/admin/logs')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });
});
