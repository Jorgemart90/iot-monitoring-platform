import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer } from 'kafkajs';
import { KAFKA_TOPICS } from '@app/common';
import { AnalyticsService } from '../analytics/analytics.service';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private consumer: Consumer;

  constructor(
    private readonly configService: ConfigService,
    private readonly analyticsService: AnalyticsService,
  ) {
    const kafka = new Kafka({
      clientId: 'analytics-service',
      brokers: [this.configService.get<string>('KAFKA_BROKER', 'localhost:9092')],
    });
    this.consumer = kafka.consumer({ groupId: 'analytics-service' });
  }

  async onModuleInit() {
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: KAFKA_TOPICS.DEVICE_READINGS,
      fromBeginning: false,
    });

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const reading = JSON.parse(message.value.toString());
          await this.analyticsService.processReading(reading);
        } catch (error) {
          this.logger.error('Error processing Kafka message', error);
        }
      },
    });

    this.logger.log('Kafka consumer connected and listening to device.readings');
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }
}
