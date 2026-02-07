import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request, { Response } from 'supertest';
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
import { ReportsModule } from '@app/reports';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function binaryParser(res: Response, callback: (error: Error | null, body: Buffer) => void): void {
  const chunks: Buffer[] = [];

  res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

describe('Reports (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let employeeRepository: Repository<Employee>;
  let attendanceRepository: Repository<Attendance>;

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
        TypeOrmModule.forFeature([Employee, Attendance]),
        PassportModule,
        JwtModule.register({}),
        UsersModule,
        ReportsModule,
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

    employeeRepository = moduleFixture.get<Repository<Employee>>(getRepositoryToken(Employee));
    attendanceRepository = moduleFixture.get<Repository<Attendance>>(getRepositoryToken(Attendance));

    const registerPayload = {
      email: 'reports-admin@test.com',
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
    await attendanceRepository.createQueryBuilder().delete().from(Attendance).execute();
    await employeeRepository.createQueryBuilder().delete().from(Employee).execute();

    const employees = await employeeRepository.save([
      employeeRepository.create({
        names: 'Employee B',
        email: 'employee-b@company.com',
        employeeIdentifier: 'EMP-002',
        phoneNumber: '+250788120002',
      }),
      employeeRepository.create({
        names: 'Employee A',
        email: 'employee-a@company.com',
        employeeIdentifier: 'EMP-001',
        phoneNumber: '+250788120001',
      }),
    ]);

    await attendanceRepository.save(
      attendanceRepository.create({
        employeeId: employees[0].id,
        date: '2026-02-07',
        checkInAt: new Date('2026-02-07T09:00:00'),
        checkOutAt: null,
      }),
    );
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  const authHeader = () => ({ Authorization: `Bearer ${accessToken}` });

  it('downloads daily attendance PDF with correct headers and non-empty content', async () => {
    const res = await request(app.getHttpServer())
      .get('/reports/attendance/daily.pdf?date=2026-02-07')
      .set(authHeader())
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    expect(res.header['content-type']).toContain('application/pdf');
    expect(res.header['content-disposition']).toContain('attendance-daily-2026-02-07.pdf');
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(100);
    expect(res.body.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('downloads daily attendance Excel with correct headers and non-empty content', async () => {
    const res = await request(app.getHttpServer())
      .get('/reports/attendance/daily.xlsx?date=2026-02-07')
      .set(authHeader())
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    expect(res.header['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.header['content-disposition']).toContain('attendance-daily-2026-02-07.xlsx');
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(100);
  });

  it('requires JWT auth for report endpoints', async () => {
    await request(app.getHttpServer())
      .get('/reports/attendance/daily.pdf?date=2026-02-07')
      .expect(401);
  });

  it('validates date format query', async () => {
    await request(app.getHttpServer())
      .get('/reports/attendance/daily.xlsx?date=07-02-2026')
      .set(authHeader())
      .expect(400);
  });
});
