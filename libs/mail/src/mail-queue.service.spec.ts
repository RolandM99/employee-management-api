import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { Queue } from 'bull';
import {
  MAIL_JOB_SEND_ATTENDANCE_NOTIFICATION,
  MAIL_JOB_SEND_RESET_PASSWORD_EMAIL,
  MAIL_QUEUE_NAME,
} from './constants';
import { MailQueueService } from './mail-queue.service';

describe('MailQueueService', () => {
  let service: MailQueueService;
  let queue: jest.Mocked<Partial<Queue>>;

  beforeEach(async () => {
    queue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailQueueService,
        {
          provide: getQueueToken(MAIL_QUEUE_NAME),
          useValue: queue,
        },
      ],
    }).compile();

    service = module.get<MailQueueService>(MailQueueService);
  });

  it('should enqueue reset password mail job', async () => {
    await service.enqueueResetPasswordEmail({
      email: 'user@test.com',
      resetUrl: 'http://localhost:3001/reset-password?token=test-token',
    });

    expect(queue.add).toHaveBeenCalledWith(
      MAIL_JOB_SEND_RESET_PASSWORD_EMAIL,
      {
        email: 'user@test.com',
        resetUrl: 'http://localhost:3001/reset-password?token=test-token',
      },
      expect.objectContaining({
        attempts: 3,
      }),
    );
  });

  it('should enqueue attendance notification job', async () => {
    await service.enqueueAttendanceNotification({
      email: 'employee@test.com',
      employeeName: 'John Doe',
      attendanceDate: '2026-02-07',
      status: 'check-out',
      occurredAt: '2026-02-07T17:00:00.000Z',
    });

    expect(queue.add).toHaveBeenCalledWith(
      MAIL_JOB_SEND_ATTENDANCE_NOTIFICATION,
      {
        email: 'employee@test.com',
        employeeName: 'John Doe',
        attendanceDate: '2026-02-07',
        status: 'check-out',
        occurredAt: '2026-02-07T17:00:00.000Z',
      },
      expect.objectContaining({
        attempts: 3,
      }),
    );
  });
});
