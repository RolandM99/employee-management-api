import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { Repository } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { User } from '@app/users';
import { Employee } from '@app/employees';
import { Attendance, AttendanceController, AttendanceService } from '@app/attendance';
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

describe('Attendance (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let employeeRepository: Repository<Employee>;
  let attendanceRepository: Repository<Attendance>;
  let mailQueueServiceMock: {
    enqueueResetPasswordEmail: jest.Mock;
    enqueueAttendanceNotification: jest.Mock;
  };

  beforeAll(async () => {
    mailQueueServiceMock = {
      enqueueResetPasswordEmail: jest.fn().mockResolvedValue(undefined),
      enqueueAttendanceNotification: jest.fn().mockResolvedValue(undefined),
    };

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
        TypeOrmModule.forFeature([Employee, Attendance]),
        PassportModule,
        JwtModule.register({}),
        UsersModule,
      ],
      controllers: [AuthController, AttendanceController],
      providers: [
        AuthService,
        AttendanceService,
        {
          provide: MailQueueService,
          useValue: mailQueueServiceMock,
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

    employeeRepository = moduleFixture.get<Repository<Employee>>(getRepositoryToken(Employee));
    attendanceRepository = moduleFixture.get<Repository<Attendance>>(
      getRepositoryToken(Attendance),
    );

    const registerPayload = {
      email: 'attendance-admin@test.com',
      password: 'StrongP@ss1',
    };

    await request(app.getHttpServer()).post('/auth/register').send(registerPayload).expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send(registerPayload)
      .expect(200);

    accessToken = loginRes.body.accessToken;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    // MySQL does not allow TRUNCATE on FK-referenced tables.
    // Use ordered DELETE statements instead.
    await attendanceRepository.createQueryBuilder().delete().from(Attendance).execute();
    await employeeRepository.createQueryBuilder().delete().from(Employee).execute();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  const authHeader = () => ({ Authorization: `Bearer ${accessToken}` });

  async function createEmployee(seed = '1'): Promise<Employee> {
    const employee = employeeRepository.create({
      names: `Employee ${seed}`,
      email: `employee-${seed}@company.com`,
      employeeIdentifier: `EMP-${seed}`,
      phoneNumber: `+250788000${seed.padStart(3, '0')}`,
    });

    return employeeRepository.save(employee);
  }

  describe('Auth protection', () => {
    it('rejects check-in without token', async () => {
      await request(app.getHttpServer())
        .post('/attendance/check-in')
        .send({ employeeId: '11111111-1111-1111-1111-111111111111' })
        .expect(401);
    });

    it('rejects check-out without token', async () => {
      await request(app.getHttpServer())
        .post('/attendance/check-out')
        .send({ employeeId: '11111111-1111-1111-1111-111111111111' })
        .expect(401);
    });

    it('rejects list without token', async () => {
      await request(app.getHttpServer()).get('/attendance').expect(401);
    });
  });

  describe('Check-in/check-out rules', () => {
    it('checks in and enqueues email notification', async () => {
      const employee = await createEmployee('1');

      const res = await request(app.getHttpServer())
        .post('/attendance/check-in')
        .set(authHeader())
        .send({ employeeId: employee.id, occurredAt: '2026-02-07T09:00:00' })
        .expect(201);

      expect(res.body.employeeId).toBe(employee.id);
      expect(res.body.checkOutAt).toBeNull();
      expect(mailQueueServiceMock.enqueueAttendanceNotification).toHaveBeenCalledWith({
        email: employee.email,
        employeeName: employee.names,
        attendanceDate: '2026-02-07',
        status: 'check-in',
        occurredAt: new Date('2026-02-07T09:00:00').toISOString(),
      });
    });

    it('returns 409 when checking in twice for same date', async () => {
      const employee = await createEmployee('2');

      await request(app.getHttpServer())
        .post('/attendance/check-in')
        .set(authHeader())
        .send({ employeeId: employee.id, occurredAt: '2026-02-07T09:00:00' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/attendance/check-in')
        .set(authHeader())
        .send({ employeeId: employee.id, occurredAt: '2026-02-07T09:30:00' })
        .expect(409);
    });

    it('returns 409 when checking out before check-in', async () => {
      const employee = await createEmployee('3');

      await request(app.getHttpServer())
        .post('/attendance/check-out')
        .set(authHeader())
        .send({ employeeId: employee.id, occurredAt: '2026-02-07T17:00:00' })
        .expect(409);
    });

    it('checks out after check-in and enqueues email notification', async () => {
      const employee = await createEmployee('4');

      await request(app.getHttpServer())
        .post('/attendance/check-in')
        .set(authHeader())
        .send({ employeeId: employee.id, occurredAt: '2026-02-07T09:00:00' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/attendance/check-out')
        .set(authHeader())
        .send({ employeeId: employee.id, occurredAt: '2026-02-07T17:00:00' })
        .expect(200);

      expect(res.body.checkOutAt).toBeDefined();
      expect(mailQueueServiceMock.enqueueAttendanceNotification).toHaveBeenCalledWith({
        email: employee.email,
        employeeName: employee.names,
        attendanceDate: '2026-02-07',
        status: 'check-out',
        occurredAt: new Date('2026-02-07T17:00:00').toISOString(),
      });
    });

    it('returns 409 when checking out twice for same date', async () => {
      const employee = await createEmployee('5');

      await request(app.getHttpServer())
        .post('/attendance/check-in')
        .set(authHeader())
        .send({ employeeId: employee.id, occurredAt: '2026-02-07T09:00:00' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/attendance/check-out')
        .set(authHeader())
        .send({ employeeId: employee.id, occurredAt: '2026-02-07T17:00:00' })
        .expect(200);

      await request(app.getHttpServer())
        .post('/attendance/check-out')
        .set(authHeader())
        .send({ employeeId: employee.id, occurredAt: '2026-02-07T17:30:00' })
        .expect(409);
    });

    it('handles concurrent check-in safely (one success, one conflict)', async () => {
      const employee = await createEmployee('6');
      const payload = { employeeId: employee.id, occurredAt: '2026-02-07T09:00:00' };

      const [resA, resB] = await Promise.all([
        request(app.getHttpServer()).post('/attendance/check-in').set(authHeader()).send(payload),
        request(app.getHttpServer()).post('/attendance/check-in').set(authHeader()).send(payload),
      ]);

      const statuses = [resA.status, resB.status].sort((a, b) => a - b);
      expect(statuses).toEqual([201, 409]);

      const recordCount = await attendanceRepository.count({
        where: { employeeId: employee.id, date: '2026-02-07' },
      });
      expect(recordCount).toBe(1);
      expect(mailQueueServiceMock.enqueueAttendanceNotification).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /attendance filters', () => {
    it('lists attendance and filters by employee/date range', async () => {
      const employeeA = await createEmployee('7');
      const employeeB = await createEmployee('8');

      await request(app.getHttpServer())
        .post('/attendance/check-in')
        .set(authHeader())
        .send({ employeeId: employeeA.id, occurredAt: '2026-02-07T09:00:00' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/attendance/check-in')
        .set(authHeader())
        .send({ employeeId: employeeB.id, occurredAt: '2026-02-08T09:00:00' })
        .expect(201);

      const allRes = await request(app.getHttpServer())
        .get('/attendance')
        .set(authHeader())
        .expect(200);

      expect(allRes.body.length).toBe(2);

      const byEmployeeRes = await request(app.getHttpServer())
        .get(`/attendance?employeeId=${employeeA.id}`)
        .set(authHeader())
        .expect(200);

      expect(byEmployeeRes.body.length).toBe(1);
      expect(byEmployeeRes.body[0].employeeId).toBe(employeeA.id);

      const byDateFromRes = await request(app.getHttpServer())
        .get('/attendance?dateFrom=2026-02-08')
        .set(authHeader())
        .expect(200);

      expect(byDateFromRes.body.length).toBe(1);
      expect(byDateFromRes.body[0].date).toBe('2026-02-08');

      const byDateRangeRes = await request(app.getHttpServer())
        .get('/attendance?dateFrom=2026-02-07&dateTo=2026-02-07')
        .set(authHeader())
        .expect(200);

      expect(byDateRangeRes.body.length).toBe(1);
      expect(byDateRangeRes.body[0].date).toBe('2026-02-07');
    });

    it('validates filter query params', async () => {
      await request(app.getHttpServer())
        .get('/attendance?employeeId=invalid-uuid')
        .set(authHeader())
        .expect(400);
    });

    it('returns 400 for invalid date range', async () => {
      await request(app.getHttpServer())
        .get('/attendance?dateFrom=2026-02-09&dateTo=2026-02-07')
        .set(authHeader())
        .expect(400);
    });
  });
});
