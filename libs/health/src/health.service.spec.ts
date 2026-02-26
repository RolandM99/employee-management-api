import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { HealthService } from './health.service';

type RedisClientMock = {
  status: string;
  connect: jest.Mock;
  ping: jest.Mock;
  quit: jest.Mock;
  disconnect: jest.Mock;
};

describe('HealthService', () => {
  let service: HealthService;
  let dataSource: { query: jest.Mock };

  beforeEach(async () => {
    dataSource = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (key === 'redis.host') {
                return 'localhost';
              }

              if (key === 'redis.port') {
                return 6379;
              }

              throw new Error(`Unexpected config key: ${key}`);
            }),
          },
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  const createRedisClientMock = (status = 'ready'): RedisClientMock => ({
    status,
    connect: jest.fn(),
    ping: jest.fn(),
    quit: jest.fn(),
    disconnect: jest.fn(),
  });

  it('returns ok when database and redis are reachable', async () => {
    const redisClient = createRedisClientMock('ready');
    dataSource.query.mockResolvedValue([{ ok: 1 }]);
    redisClient.connect.mockResolvedValue(undefined);
    redisClient.ping.mockResolvedValue('PONG');
    redisClient.quit.mockResolvedValue('OK');

    jest
      .spyOn(
        service as unknown as { createRedisClient: () => RedisClientMock },
        'createRedisClient',
      )
      .mockReturnValue(redisClient);

    const result = await service.check();

    expect(result.status).toBe('ok');
    expect(result.checks.database.status).toBe('up');
    expect(result.checks.redis.status).toBe('up');
    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
    expect(redisClient.connect).toHaveBeenCalled();
    expect(redisClient.ping).toHaveBeenCalled();
    expect(redisClient.quit).toHaveBeenCalled();
  });

  it('returns error when database is unavailable', async () => {
    const redisClient = createRedisClientMock('ready');
    dataSource.query.mockRejectedValue(new Error('DB unavailable'));
    redisClient.connect.mockResolvedValue(undefined);
    redisClient.ping.mockResolvedValue('PONG');
    redisClient.quit.mockResolvedValue('OK');

    jest
      .spyOn(
        service as unknown as { createRedisClient: () => RedisClientMock },
        'createRedisClient',
      )
      .mockReturnValue(redisClient);

    const result = await service.check();

    expect(result.status).toBe('error');
    expect(result.checks.database.status).toBe('down');
    expect(result.checks.database.message).toBe('DB unavailable');
    expect(result.checks.redis.status).toBe('up');
  });

  it('returns error when redis is unavailable', async () => {
    const redisClient = createRedisClientMock('end');
    dataSource.query.mockResolvedValue([{ ok: 1 }]);
    redisClient.connect.mockRejectedValue(new Error('Redis unavailable'));

    jest
      .spyOn(
        service as unknown as { createRedisClient: () => RedisClientMock },
        'createRedisClient',
      )
      .mockReturnValue(redisClient);

    const result = await service.check();

    expect(result.status).toBe('error');
    expect(result.checks.database.status).toBe('up');
    expect(result.checks.redis.status).toBe('down');
    expect(result.checks.redis.message).toBe('Redis unavailable');
    expect(redisClient.disconnect).toHaveBeenCalled();
  });
});
