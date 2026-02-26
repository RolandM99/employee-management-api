import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import {
  MAIL_JOB_SEND_ATTENDANCE_NOTIFICATION,
  MAIL_JOB_SEND_RESET_PASSWORD_EMAIL,
  MAIL_QUEUE_NAME,
} from './constants';
import { SendAttendanceNotificationPayload, SendResetPasswordEmailPayload } from './interfaces';
import { MailDeliveryService } from './mail-delivery.service';

@Processor(MAIL_QUEUE_NAME)
export class MailProcessor {
  constructor(private readonly mailDeliveryService: MailDeliveryService) {}

  @Process(MAIL_JOB_SEND_RESET_PASSWORD_EMAIL)
  async handleResetPasswordEmail(job: Job<SendResetPasswordEmailPayload>): Promise<void> {
    await this.mailDeliveryService.sendResetPasswordEmail(job.data);
  }

  @Process(MAIL_JOB_SEND_ATTENDANCE_NOTIFICATION)
  async handleAttendanceNotification(job: Job<SendAttendanceNotificationPayload>): Promise<void> {
    await this.mailDeliveryService.sendAttendanceNotification(job.data);
  }
}
