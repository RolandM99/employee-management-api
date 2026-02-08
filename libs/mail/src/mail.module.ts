import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { MAIL_QUEUE_NAME } from './constants';
import { MailQueueService } from './mail-queue.service';
import { MailDeliveryService } from './mail-delivery.service';
import { MailProcessor } from './mail.processor';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.getOrThrow<string>('redis.host'),
          port: configService.getOrThrow<number>('redis.port'),
        },
      }),
    }),
    BullModule.registerQueue({
      name: MAIL_QUEUE_NAME,
    }),
  ],
  providers: [MailQueueService, MailDeliveryService, MailProcessor],
  exports: [MailQueueService],
})
export class MailModule {}
