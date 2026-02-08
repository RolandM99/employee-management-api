import { Test, TestingModule } from '@nestjs/testing';
import { BullModule, getQueueToken } from '@nestjs/bull';
import { Queue } from 'bull';
import {
  MAIL_JOB_SEND_ATTENDANCE_NOTIFICATION,
  MAIL_JOB_SEND_RESET_PASSWORD_EMAIL,
  MAIL_QUEUE_NAME,
} from '@app/mail/constants';
import { MailQueueService } from '@app/mail/mail-queue.service';

const runRedisIntegration = process.env.RUN_REDIS_INTEGRATION === 'true';
const describeRedis = runRedisIntegration ? describe : describe.skip;

describeRedis('MailQueueService (integration)', () => {
  let moduleRef: TestingModule;
  let service: MailQueueService;
  let queue: Queue;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        BullModule.forRoot({
          redis: {
            host: process.env.REDIS_HOST ?? '127.0.0.1',
            port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
          },
        }),
        BullModule.registerQueue({ name: MAIL_QUEUE_NAME }),
      ],
      providers: [MailQueueService],
    }).compile();

    service = moduleRef.get(MailQueueService);
    queue = moduleRef.get<Queue>(getQueueToken(MAIL_QUEUE_NAME));
    await queue.empty();
  });

  afterAll(async () => {
    if (queue) {
      await queue.empty();
      await queue.close();
    }

    if (moduleRef) {
      await moduleRef.close();
    }
  });

  it('adds reset password job with expected payload', async () => {
    const payload = {
      email: 'user@test.com',
      resetUrl: 'http://localhost:3001/reset-password?token=token-123',
    };

    await service.enqueueResetPasswordEmail(payload);

    const jobs = await queue.getJobs(['waiting', 'delayed']);
    const targetJob = jobs.find((job) => job.name === MAIL_JOB_SEND_RESET_PASSWORD_EMAIL);

    expect(targetJob).toBeDefined();
    expect(targetJob?.data).toEqual(payload);
  });

  it('adds attendance notification job with expected payload', async () => {
    const payload = {
      email: 'employee@test.com',
      employeeName: 'John Doe',
      attendanceDate: '2026-02-07',
      status: 'check-in' as const,
      occurredAt: '2026-02-07T11:00:00.000Z',
    };

    await service.enqueueAttendanceNotification(payload);

    const jobs = await queue.getJobs(['waiting', 'delayed']);
    const targetJob = jobs.find((job) => job.name === MAIL_JOB_SEND_ATTENDANCE_NOTIFICATION);

    expect(targetJob).toBeDefined();
    expect(targetJob?.data).toEqual(payload);
  });
});
