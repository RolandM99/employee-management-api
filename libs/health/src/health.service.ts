import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';

interface DependencyHealth {
  status: 'up' | 'down';
  latencyMs: number;
  message?: string;
}

export interface HealthCheckResult {
  status: 'ok' | 'error';
  checks: {
    database: DependencyHealth;
    redis: DependencyHealth;
  };
}

@Injectable()
export class HealthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async check(): Promise<HealthCheckResult> {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);
    const status = database.status === 'up' && redis.status === 'up' ? 'ok' : 'error';

    return {
      status,
      checks: {
        database,
        redis,
      },
    };
  }

  private async checkDatabase(): Promise<DependencyHealth> {
    const start = Date.now();

    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'up',
        latencyMs: Date.now() - start,
      };
    } catch (error: unknown) {
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        message: this.toErrorMessage(error),
      };
    }
  }

  private async checkRedis(): Promise<DependencyHealth> {
    const client = this.createRedisClient();
    const start = Date.now();

    try {
      await client.connect();
      const pingResponse = await client.ping();
      if (pingResponse !== 'PONG') {
        throw new Error(`Unexpected Redis ping response: ${pingResponse}`);
      }

      return {
        status: 'up',
        latencyMs: Date.now() - start,
      };
    } catch (error: unknown) {
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        message: this.toErrorMessage(error),
      };
    } finally {
      try {
        if (client.status === 'ready') {
          await client.quit();
        } else {
          client.disconnect();
        }
      } catch {
        client.disconnect();
      }
    }
  }

  private createRedisClient(): Redis {
    return new Redis({
      host: this.configService.getOrThrow<string>('redis.host'),
      port: this.configService.getOrThrow<number>('redis.port'),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
    });
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
