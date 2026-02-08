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
import { Employee, EmployeesModule } from '@app/employees';
import { Attendance } from '@app/attendance';
import { UsersModule } from '@app/users';
import { AuthService } from '@app/auth/auth.service';
import { AuthController } from '@app/auth/auth.controller';
import { LocalStrategy, JwtStrategy, JwtRefreshStrategy } from '@app/auth/strategies';
import { JwtAuthGuard } from '@app/auth/guards';
import {
  appConfig,
  databaseConfig,
  jwtConfig,
  redisConfig,
  mailConfig,
  frontendConfig,
} from '@app/config';
import { MailQueueService } from '@app/mail';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

describe('Employees (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

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
        EmployeesModule,
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

    const registerPayload = {
      email: 'employees-admin@test.com',
      password: 'StrongP@ss1',
    };

    await request(app.getHttpServer()).post('/auth/register').send(registerPayload).expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send(registerPayload)
      .expect(200);

    accessToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  const createEmployeePayload = {
    names: 'John Doe',
    email: 'john.doe@company.com',
    employeeIdentifier: 'EMP-0001',
    phoneNumber: '+250784567890',
  };

  const authHeader = () => ({ Authorization: `Bearer ${accessToken}` });

  describe('Auth protection', () => {
    it('rejects unauthenticated create', async () => {
      await request(app.getHttpServer()).post('/employees').send(createEmployeePayload).expect(401);
    });

    it('rejects unauthenticated list', async () => {
      await request(app.getHttpServer()).get('/employees').expect(401);
    });
  });

  describe('CRUD flow', () => {
    let createdEmployeeId = '';

    it('creates employee', async () => {
      const res = await request(app.getHttpServer())
        .post('/employees')
        .set(authHeader())
        .send(createEmployeePayload)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.names).toBe(createEmployeePayload.names);
      expect(res.body.email).toBe(createEmployeePayload.email);
      expect(res.body.employeeIdentifier).toBe(createEmployeePayload.employeeIdentifier);
      expect(res.body.phoneNumber).toBe(createEmployeePayload.phoneNumber);

      createdEmployeeId = res.body.id;
    });

    it('validates payload on create', async () => {
      await request(app.getHttpServer())
        .post('/employees')
        .set(authHeader())
        .send({
          names: '',
          email: 'not-email',
          employeeIdentifier: '',
          phoneNumber: '123',
        })
        .expect(400);
    });

    it('returns 409 for duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/employees')
        .set(authHeader())
        .send({
          names: 'Other Employee',
          email: createEmployeePayload.email,
          employeeIdentifier: 'EMP-0002',
          phoneNumber: '+250732234343',
        })
        .expect(409);
    });

    it('returns 409 for duplicate employeeIdentifier', async () => {
      await request(app.getHttpServer())
        .post('/employees')
        .set(authHeader())
        .send({
          names: 'Other Employee',
          email: 'other.employee@company.com',
          employeeIdentifier: createEmployeePayload.employeeIdentifier,
          phoneNumber: '+250730000012',
        })
        .expect(409);
    });

    it('lists employees', async () => {
      const res = await request(app.getHttpServer())
        .get('/employees')
        .set(authHeader())
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
      expect(
        res.body.data.some((employee: { id: string }) => employee.id === createdEmployeeId),
      ).toBe(true);
    });

    it('supports pagination query params', async () => {
      const res = await request(app.getHttpServer())
        .get('/employees?page=1&limit=1')
        .set(authHeader())
        .expect(200);

      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(1);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('gets employee by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/employees/${createdEmployeeId}`)
        .set(authHeader())
        .expect(200);

      expect(res.body.id).toBe(createdEmployeeId);
      expect(res.body.email).toBe(createEmployeePayload.email);
    });

    it('returns 404 for missing employee by id', async () => {
      await request(app.getHttpServer())
        .get('/employees/11111111-1111-1111-1111-111111111111')
        .set(authHeader())
        .expect(404);
    });

    it('updates employee', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/employees/${createdEmployeeId}`)
        .set(authHeader())
        .send({ names: 'John Updated', phoneNumber: '+250786543211' })
        .expect(200);

      expect(res.body.id).toBe(createdEmployeeId);
      expect(res.body.names).toBe('John Updated');
      expect(res.body.phoneNumber).toBe('+250786543211');
    });

    it('validates payload on update', async () => {
      await request(app.getHttpServer())
        .patch(`/employees/${createdEmployeeId}`)
        .set(authHeader())
        .send({ email: 'bad-email' })
        .expect(400);
    });

    it('returns 409 for duplicate value on update', async () => {
      const secondEmployeeRes = await request(app.getHttpServer())
        .post('/employees')
        .set(authHeader())
        .send({
          names: 'Second Employee',
          email: 'second.employee@company.com',
          employeeIdentifier: 'EMP-0003',
          phoneNumber: '+250782222221',
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/employees/${createdEmployeeId}`)
        .set(authHeader())
        .send({ email: secondEmployeeRes.body.email })
        .expect(409);
    });

    it('returns 404 when updating missing employee', async () => {
      await request(app.getHttpServer())
        .patch('/employees/11111111-1111-1111-1111-111111111111')
        .set(authHeader())
        .send({ names: 'Missing Employee' })
        .expect(404);
    });

    it('deletes employee', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/employees/${createdEmployeeId}`)
        .set(authHeader())
        .expect(200);

      expect(res.body).toEqual({ message: 'Employee deleted successfully' });
    });

    it('returns 404 on deleting missing employee', async () => {
      await request(app.getHttpServer())
        .delete(`/employees/${createdEmployeeId}`)
        .set(authHeader())
        .expect(404);
    });

    it('returns 404 when retrieving deleted employee', async () => {
      await request(app.getHttpServer())
        .get(`/employees/${createdEmployeeId}`)
        .set(authHeader())
        .expect(404);
    });
  });
});
