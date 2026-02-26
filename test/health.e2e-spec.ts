import { Test, TestingModule } from '@nestjs/testing';
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import request from 'supertest';
import { IS_PUBLIC_KEY } from '@app/common';
import { HealthModule, HealthService } from '@app/health';

@Injectable()
class PublicOnlyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    return this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) === true;
  }
}

describe('Health (e2e)', () => {
  let app: INestApplication;
  let healthService: { check: jest.Mock };

  beforeAll(async () => {
    healthService = {
      check: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HealthModule],
      providers: [
        {
          provide: APP_GUARD,
          useClass: PublicOnlyGuard,
        },
      ],
    })
      .overrideProvider(HealthService)
      .useValue(healthService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('returns 200 without auth when dependencies are healthy', async () => {
    healthService.check.mockResolvedValue({
      status: 'ok',
      checks: {
        database: { status: 'up', latencyMs: 4 },
        redis: { status: 'up', latencyMs: 2 },
      },
    });

    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body.checks.database.status).toBe('up');
    expect(res.body.checks.redis.status).toBe('up');
  });

  it('returns 503 when any dependency is unhealthy', async () => {
    healthService.check.mockResolvedValue({
      status: 'error',
      checks: {
        database: { status: 'up', latencyMs: 5 },
        redis: { status: 'down', latencyMs: 10, message: 'Redis unavailable' },
      },
    });

    const res = await request(app.getHttpServer()).get('/health').expect(503);

    expect(res.body.message).toBe('Dependency health check failed');
    expect(res.body.checks.redis.status).toBe('down');
  });
});
