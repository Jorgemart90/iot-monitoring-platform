import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';
import { KAFKA_TOPICS } from '@app/common';
import { IDeviceReading } from '@app/common';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private producer: Producer;

  constructor(private readonly configService: ConfigService) {
    const kafka = new Kafka({
      clientId: 'device-service',
      brokers: [this.configService.get<string>('KAFKA_BROKER', 'localhost:9092')],
    });
    this.producer = kafka.producer();
  }

  async onModuleInit() {
    await this.producer.connect();
    this.logger.log('Kafka producer connected');
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }

  async publishReading(reading: IDeviceReading): Promise<void> {
    await this.producer.send({
      topic: KAFKA_TOPICS.DEVICE_READINGS,
      messages: [
        {
          key: reading.deviceId,
          value: JSON.stringify(reading),
        },
      ],
    });
    this.logger.debug(`Reading published for device ${reading.deviceId}`);
  }
}
