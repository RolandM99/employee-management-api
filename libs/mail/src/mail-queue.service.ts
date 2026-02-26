import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import {
  MAIL_JOB_SEND_ATTENDANCE_NOTIFICATION,
  MAIL_JOB_SEND_RESET_PASSWORD_EMAIL,
  MAIL_QUEUE_NAME,
} from './constants';
import { SendAttendanceNotificationPayload, SendResetPasswordEmailPayload } from './interfaces';

@Injectable()
export class MailQueueService {
  constructor(
    @InjectQueue(MAIL_QUEUE_NAME)
    private readonly mailQueue: Queue,
  ) {}

  enqueueResetPasswordEmail(
    payload: SendResetPasswordEmailPayload,
  ): Promise<Job<SendResetPasswordEmailPayload>> {
    return this.mailQueue.add(MAIL_JOB_SEND_RESET_PASSWORD_EMAIL, payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: 100,
    });
  }

  enqueueAttendanceNotification(
    payload: SendAttendanceNotificationPayload,
  ): Promise<Job<SendAttendanceNotificationPayload>> {
    return this.mailQueue.add(MAIL_JOB_SEND_ATTENDANCE_NOTIFICATION, payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: 100,
    });
  }
}
