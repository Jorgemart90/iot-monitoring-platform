import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer } from 'kafkajs';
import { KAFKA_TOPICS } from '@app/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private consumer: Consumer;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    const kafka = new Kafka({
      clientId: 'notification-service',
      brokers: [this.configService.get<string>('KAFKA_BROKER', 'localhost:9092')],
    });
    this.consumer = kafka.consumer({ groupId: 'notification-service' });
  }

  async onModuleInit() {
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: KAFKA_TOPICS.ALERT_TRIGGERED,
      fromBeginning: false,
    });

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const payload = message.value.toString();
          await this.redisService.publish('notifications', payload);
          this.logger.debug('Alert forwarded to Redis pub/sub');
        } catch (error) {
          this.logger.error('Error processing alert message', error);
        }
      },
    });

    this.logger.log('Notification Kafka consumer connected');
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }
}
