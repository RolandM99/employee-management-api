import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { SentMessageInfo, Transporter } from 'nodemailer';
import { MailTransportMode } from './constants';
import { SendAttendanceNotificationPayload, SendResetPasswordEmailPayload } from './interfaces';

@Injectable()
export class MailDeliveryService {
  private readonly logger = new Logger(MailDeliveryService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly configService: ConfigService) {}

  async sendResetPasswordEmail(payload: SendResetPasswordEmailPayload): Promise<void> {
    const subject = 'Reset your password';
    const text = `Use this link to reset your password: ${payload.resetUrl}`;

    await this.send({
      to: payload.email,
      subject,
      text,
      html: `<p>Use this link to reset your password:</p><p><a href="${payload.resetUrl}">${payload.resetUrl}</a></p>`,
    });
  }

  async sendAttendanceNotification(payload: SendAttendanceNotificationPayload): Promise<void> {
    const subject = `Attendance ${payload.status} recorded`;
    const text = `${payload.employeeName} has ${payload.status} on ${payload.attendanceDate} at ${payload.occurredAt}.`;

    await this.send({
      to: payload.email,
      subject,
      text,
      html: `<p>${payload.employeeName} has <strong>${payload.status}</strong> on <strong>${payload.attendanceDate}</strong> at <strong>${payload.occurredAt}</strong>.</p>`,
    });
  }

  private async send(options: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<void> {
    const mode = this.configService.getOrThrow<MailTransportMode>('mail.transport');

    if (mode === 'console') {
      this.logger.log(
        `[MAIL-CONSOLE] to=${options.to} subject="${options.subject}" text="${options.text}"`,
      );
      return;
    }

    const transporter = await this.getTransporter(mode);
    const info = await transporter.sendMail({
      from: this.configService.getOrThrow<string>('mail.from'),
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    this.logPreviewUrl(info);
  }

  private async getTransporter(mode: MailTransportMode): Promise<Transporter> {
    if (this.transporter) {
      return this.transporter;
    }

    if (mode === 'ethereal') {
      const account = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: {
          user: account.user,
          pass: account.pass,
        },
      });

      this.logger.log(`Using Ethereal transport: ${account.user}`);
      return this.transporter;
    }

    this.transporter = nodemailer.createTransport({
      host: this.configService.getOrThrow<string>('mail.host'),
      port: this.configService.getOrThrow<number>('mail.port'),
      secure: false,
      auth: {
        user: this.configService.getOrThrow<string>('mail.user'),
        pass: this.configService.getOrThrow<string>('mail.pass'),
      },
    });

    return this.transporter;
  }

  private logPreviewUrl(info: SentMessageInfo): void {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      this.logger.log(`Ethereal preview URL: ${previewUrl}`);
    }
  }
}
