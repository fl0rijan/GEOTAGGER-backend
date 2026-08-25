import { PrismaService } from '../src/prisma/prisma.service';
import { INestApplication } from '@nestjs/common';
import { Server } from 'http';
import request from 'supertest';

export async function cleanDatabase(prisma: PrismaService) {
  const tables = ['guesses', 'locations', 'action_logs', 'users'];
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
  }
}

interface LoginResponse {
  accessToken: string;
}

export async function getAuthData(
  app: INestApplication,
  email = 'tester@example.com',
  password = 'Password123!',
) {
  const prisma = app.get(PrismaService);
  const server = app.getHttpServer() as Server;

  const username = email.split('@')[0];

  await request(server).post('/signup').send({
    email,
    username,
    password,
    firstName: 'Test',
    lastName: 'User',
  });

  const loginRes = await request(server)
    .post('/login')
    .send({ email, password });

  const { accessToken } = loginRes.body as LoginResponse;
  const cookies = loginRes.get('Set-Cookie') || [];

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) throw new Error('Failed to fetch test user after signup');

  return {
    accessToken,
    cookies,
    userId: user.id,
  };
}
