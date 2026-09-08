import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertRule } from '@app/database';
import { RulesController } from './rules.controller';
import { RulesService } from './rules.service';
import { AlertAuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([AlertRule]), AlertAuthModule],
  controllers: [RulesController],
  providers: [RulesService],
  exports: [RulesService],
})
export class RulesModule {}
