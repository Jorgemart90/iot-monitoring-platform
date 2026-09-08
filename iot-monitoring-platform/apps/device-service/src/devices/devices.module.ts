import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device, DeviceReading } from '@app/database';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { DeviceAuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Device, DeviceReading]), DeviceAuthModule],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
