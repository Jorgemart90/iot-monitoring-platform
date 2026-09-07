import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@app/database';
import { RulesModule } from './rules/rules.module';
import { AlertsModule } from './alerts/alerts.module';
import { KafkaModule } from './kafka/kafka.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard, JwtSecurityModule } from '@app/common';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    DatabaseModule,
    JwtSecurityModule,
    RulesModule,
    AlertsModule,
    KafkaModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
