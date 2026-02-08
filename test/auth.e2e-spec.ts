import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { User } from '@app/users';
import { Employee } from '@app/employees';
import { Attendance } from '@app/attendance';
import { UsersModule } from '@app/users';
import { AuthService } from '@app/auth/auth.service';
import { AuthController } from '@app/auth/auth.controller';
import { LocalStrategy, JwtStrategy, JwtRefreshStrategy } from '@app/auth/strategies';
import { JwtAuthGuard } from '@app/auth/guards';
import { MailQueueService } from '@app/mail';
import {
  appConfig,
  databaseConfig,
  jwtConfig,
  redisConfig,
  mailConfig,
  frontendConfig,
} from '@app/config';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [appConfig, databaseConfig, jwtConfig, redisConfig, mailConfig, frontendConfig],
        }),
        TypeOrmModule.forRoot({
          type: 'mysql',
          host: process.env.DB_HOST ?? 'localhost',
          port: parseInt(process.env.DB_PORT ?? '3306', 10),
          username: process.env.DB_USERNAME ?? '',
          password: process.env.DB_PASSWORD ?? '',
          database: process.env.DB_DATABASE ?? '',
          entities: [User, Employee, Attendance],
          synchronize: true,
          dropSchema: true,
        }),
        PassportModule,
        JwtModule.register({}),
        UsersModule,
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        {
          provide: MailQueueService,
          useValue: {
            enqueueResetPasswordEmail: jest.fn().mockResolvedValue(undefined),
            enqueueAttendanceNotification: jest.fn().mockResolvedValue(undefined),
          },
        },
        LocalStrategy,
        JwtStrategy,
        JwtRefreshStrategy,
        {
          provide: APP_GUARD,
          useClass: JwtAuthGuard,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  const testUser = {
    email: 'e2e@test.com',
    password: 'StrongP@ss1',
    role: 'admin',
  };

  let accessToken: string;
  let refreshToken: string;

  describe('POST /auth/register', () => {
    it('should register a new user and return tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('should reject duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(409);
    });

    it('should reject invalid email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'not-an-email', password: 'StrongP@ss1' })
        .expect(400);
    });

    it('should reject short password', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'new@test.com', password: 'short' })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('should reject invalid password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: 'wrongpassword' })
        .expect(401);
    });

    it('should reject non-existent email', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@test.com', password: 'StrongP@ss1' })
        .expect(401);
    });
  });

  describe('GET /auth/profile', () => {
    it('should return profile with valid access token', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.email).toBe(testUser.email);
      expect(res.body).not.toHaveProperty('passwordHash');
      expect(res.body).not.toHaveProperty('refreshTokenHash');
    });

    it('should reject request without token', async () => {
      await request(app.getHttpServer())
        .get('/auth/profile')
        .expect(401);
    });

    it('should reject request with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should issue new tokens with valid refresh token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('should reject old refresh token after rotation', async () => {
      // Login fresh to get a known token pair
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);

      const firstRefresh = loginRes.body.refreshToken;

      // Rotate by refreshing
      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: firstRefresh })
        .expect(200);

      accessToken = refreshRes.body.accessToken;
      refreshToken = refreshRes.body.refreshToken;

      // Old token should now be rejected (hash mismatch)
      const retryRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: firstRefresh });

      expect([401, 403]).toContain(retryRes.status);
    });

    it('should reject empty refresh token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({})
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout and invalidate refresh token', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Refresh token should no longer work
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });

    it('should reject logout without access token', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .expect(401);
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('should return 200 for existing email', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: testUser.email })
        .expect(200);

      expect(res.body.message).toBe('If the email exists, a reset link will be sent');
    });

    it('should return 200 for non-existent email (no enumeration)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'doesnotexist@test.com' })
        .expect(200);

      expect(res.body.message).toBe('If the email exists, a reset link will be sent');
    });

    it('should reject invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'not-an-email' })
        .expect(400);
    });
  });

  describe('POST /auth/reset-password', () => {
    it('should reject an invalid token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'invalid-token', newPassword: 'NewStr0ngP@ss' })
        .expect(400);

      expect(res.body.message).toBe('Invalid or expired reset token');
    });

    it('should reject short new password', async () => {
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'some-token', newPassword: 'short' })
        .expect(400);
    });

    it('should reject missing token', async () => {
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ newPassword: 'NewStr0ngP@ss' })
        .expect(400);
    });

    it('should reject missing new password', async () => {
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'some-token' })
        .expect(400);
    });
  });

  describe('Password reset full flow', () => {
    /**
     * This tests the full flow by directly calling the service to get the raw token
     * (since in dev mode the token is only logged to console).
     * In a real scenario, the user would receive this token via email.
     */
    it('should reset password and allow login with new password', async () => {
      // Step 1: Register a fresh user for this flow
      const flowUser = { email: 'reset-flow@test.com', password: 'OldP@ssw0rd' };
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(flowUser)
        .expect(201);

      // Step 2: Trigger forgot-password (token is logged in dev, we can't capture it via HTTP)
      // Instead we directly use the auth service to get access to the internals
      // We'll work around by directly setting a known reset token via the users service
      const { createHash, randomBytes } = await import('crypto');
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      // Get the UsersService from the app to set the token directly
      const { UsersService: UsersServiceClass } = await import('@app/users');
      const usersService = app.get(UsersServiceClass);
      const user = await usersService.findByEmail(flowUser.email);
      await usersService.updateResetToken(user!.id, tokenHash, expiresAt);

      // Step 3: Reset password via the endpoint
      const newPassword = 'NewStr0ngP@ss';
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: rawToken, newPassword })
        .expect(200);

      // Step 4: Old password should no longer work
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: flowUser.email, password: flowUser.password })
        .expect(401);

      // Step 5: New password should work
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: flowUser.email, password: newPassword })
        .expect(200);

      expect(loginRes.body.accessToken).toBeDefined();
    });

    it('should reject reuse of the same reset token', async () => {
      // Register a user
      const flowUser2 = { email: 'reset-reuse@test.com', password: 'OldP@ssw0rd' };
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(flowUser2)
        .expect(201);

      const { createHash, randomBytes } = await import('crypto');
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const { UsersService: UsersServiceClass } = await import('@app/users');
      const usersService = app.get(UsersServiceClass);
      const user = await usersService.findByEmail(flowUser2.email);
      await usersService.updateResetToken(user!.id, tokenHash, expiresAt);

      // First reset should succeed
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: rawToken, newPassword: 'NewStr0ngP@ss' })
        .expect(200);

      // Second reset with same token should fail (token was cleared)
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: rawToken, newPassword: 'AnotherP@ss1' })
        .expect(400);
    });
  });
});
