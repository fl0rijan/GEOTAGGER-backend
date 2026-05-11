import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanDatabase } from './test-utils';
import { MailService } from '../src/modules/mail/mail.service';
import cookieParser from 'cookie-parser';
import { Server } from 'http';
import { TokenResponse } from '../src/modules/auth/dto/token-response.dto';
import { UserResponseDto } from '../src/modules/users/dto/user-response.dto';

interface ResetPasswordResponse {
  message: string;
}

describe('Auth Module', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const mailServiceMock = {
    sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue(mailServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  const testUser = {
    email: 'jamal@example.com',
    password: 'Password123!',
    username: 'jamal',
    firstName: 'Jamal',
    lastName: 'Black',
  };

  describe('/signup (POST)', () => {
    it('should register a new user and give 10 points', async () => {
      await request(app.getHttpServer() as Server)
        .post('/signup')
        .send(testUser)
        .expect(201);

      const user = await prisma.user.findUnique({
        where: { email: testUser.email },
      });

      if (!user) throw new Error('User was not created in DB');

      expect(user.gamePoints).toBe(10);
      expect(user.password).not.toBe(testUser.password);
    });
  });

  describe('/login (POST)', () => {
    it('should login and return access token', async () => {
      await request(app.getHttpServer() as Server)
        .post('/signup')
        .send(testUser);

      const res = await request(app.getHttpServer() as Server)
        .post('/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);

      const body = res.body as TokenResponse;
      expect(body.accessToken).toBeDefined();
    });
  });

  describe('/me (GET)', () => {
    it('should return user profile when authenticated', async () => {
      await request(app.getHttpServer() as Server)
        .post('/signup')
        .send(testUser);

      const loginRes = await request(app.getHttpServer() as Server)
        .post('/login')
        .send({ email: testUser.email, password: testUser.password });

      const { accessToken } = loginRes.body as TokenResponse;

      const res = await request(app.getHttpServer() as Server)
        .get('/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = res.body as UserResponseDto;
      expect(body.email).toBe(testUser.email);
    });
  });

  describe('/me/update-password (PATCH)', () => {
    it('should update users password to the new one', async () => {
      await request(app.getHttpServer() as Server)
        .post('/signup')
        .send(testUser);

      const loginRes = await request(app.getHttpServer() as Server)
        .post('/login')
        .send({ email: testUser.email, password: testUser.password });

      const { accessToken } = loginRes.body as TokenResponse;

      const res = await request(app.getHttpServer() as Server)
        .patch('/me/update-password')
        .send({
          currentPassword: testUser.password,
          newPassword: 'NewSecurePassword123!',
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = res.body as ResetPasswordResponse;
      expect(body.message).toBe('Password updated!');
    });
  });

  describe('/me/update-password (PATCH)', () => {
    it('should get bad request cause we used the same password we already have', async () => {
      await request(app.getHttpServer() as Server)
        .post('/signup')
        .send(testUser);

      const loginRes = await request(app.getHttpServer() as Server)
        .post('/login')
        .send({ email: testUser.email, password: testUser.password });

      const { accessToken } = loginRes.body as TokenResponse;

      const res = await request(app.getHttpServer() as Server)
        .patch('/me/update-password')
        .send({
          currentPassword: testUser.password,
          newPassword: testUser.password,
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      const body = res.body as ResetPasswordResponse;
      expect(body.message).toBe(
        'New password cannot be the same as current password.',
      );
    });
  });

  describe('/verify-email (POST)', () => {
    it('should verify user when given correct token', async () => {
      await request(app.getHttpServer() as Server)
        .post('/signup')
        .send(testUser);
      const userBefore = await prisma.user.findUnique({
        where: { email: testUser.email },
      });

      if (!userBefore) throw new Error('User missing');

      await request(app.getHttpServer() as Server)
        .post(`/verify-email?token=${userBefore.verifyEmailToken}`)
        .expect(201);

      const userAfter = await prisma.user.findUnique({
        where: { email: testUser.email },
      });

      if (!userAfter) throw new Error('User deleted accidentally');
      expect(userAfter.verified).toBe(true);
      expect(userAfter.verifyEmailToken).toBeNull();
    });
  });

  describe('Password Reset', () => {
    it('should fulfill the reset process', async () => {
      await request(app.getHttpServer() as Server)
        .post('/signup')
        .send(testUser);

      await request(app.getHttpServer() as Server)
        .post('/forgot-password')
        .send({ email: testUser.email })
        .expect(201);

      const user = await prisma.user.findUnique({
        where: { email: testUser.email },
      });
      if (!user || !user.resetPasswordToken)
        throw new Error('Reset token not generated');

      const newPassword = 'NewSecurePassword123!';
      await request(app.getHttpServer() as Server)
        .post('/reset-password')
        .send({ token: user.resetPasswordToken, newPassword })
        .expect(201);

      await request(app.getHttpServer() as Server)
        .post('/login')
        .send({ email: testUser.email, password: newPassword })
        .expect(200);
    });
  });

  describe('/logout (POST)', () => {
    it('should clear refresh token in database', async () => {
      await request(app.getHttpServer() as Server)
        .post('/signup')
        .send(testUser);

      const loginRes = await request(app.getHttpServer() as Server)
        .post('/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);

      const body = loginRes.body as TokenResponse;
      const accessToken = body.accessToken;

      const cookies = loginRes.get('Set-Cookie') || [];

      await request(app.getHttpServer() as Server)
        .post('/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', cookies)
        .expect(201);

      const user = await prisma.user.findUnique({
        where: { email: testUser.email },
      });
      if (!user) throw new Error('User missing');
      expect(user.refreshToken).toBeNull();
    });
  });

  describe('/refresh (POST)', () => {
    it('should return a new access token when a valid refresh cookie is provided', async () => {
      await request(app.getHttpServer() as Server)
        .post('/signup')
        .send(testUser);
      const loginRes = await request(app.getHttpServer() as Server)
        .post('/login')
        .send({ email: testUser.email, password: testUser.password });

      const cookies = loginRes.get('Set-Cookie') || [];

      const userBefore = await prisma.user.findUnique({
        where: { email: testUser.email },
      });
      const oldRefreshToken = userBefore?.refreshToken;

      await request(app.getHttpServer() as Server)
        .post('/refresh')
        .set('Cookie', cookies);

      const userAfter = await prisma.user.findUnique({
        where: { email: testUser.email },
      });
      expect(userAfter?.refreshToken).not.toBe(oldRefreshToken);

      const refreshRes = await request(app.getHttpServer() as Server)
        .post('/refresh')
        .set('Cookie', cookies)
        .expect(201);

      const body = refreshRes.body as TokenResponse;
      expect(body.accessToken).toBeDefined();
      expect(typeof body.accessToken).toBe('string');
    });

    it('should fail to refresh if cookie is missing', async () => {
      await request(app.getHttpServer() as Server)
        .post('/refresh')
        .expect(401);
    });
  });

  it('/google (GET) - should redirect to google accounts', async () => {
    const res = await request(app.getHttpServer() as Server)
      .get('/google')
      .expect(302);

    expect(res.header.location).toContain(
      'https://accounts.google.com/o/oauth2/v2/auth?response_type=code&redirect_uri',
    );
  });

  it('/facebook (GET) - should redirect to facebook accounts', async () => {
    const res = await request(app.getHttpServer() as Server)
      .get('/facebook')
      .expect(302);

    expect(res.header.location).toContain(
      'https://www.facebook.com/v3.2/dialog/oauth?response_type=code&redirect_uri',
    );
  });

  describe('/me', () => {
    it('should update your own profile information', async () => {
      await request(app.getHttpServer() as Server)
        .post('/signup')
        .send(testUser);

      const loginRes = await request(app.getHttpServer() as Server)
        .post('/login')
        .send({ email: testUser.email, password: testUser.password });

      const { accessToken } = loginRes.body as TokenResponse;

      const res = await request(app.getHttpServer() as Server)
        .patch('/me')
        .send({
          firstName: 'Updated',
          lastName: 'UpdatedLastName',
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = res.body as ResetPasswordResponse;
      expect(body.message).toBe('Successfully updated profile information');

      const me = await request(app.getHttpServer() as Server)
        .get('/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const meBody = me.body as UserResponseDto;
      expect(meBody.firstName).toBe('Updated');
    });
  });
});
