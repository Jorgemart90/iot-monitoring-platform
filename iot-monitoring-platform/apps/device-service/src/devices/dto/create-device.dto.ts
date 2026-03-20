import { IsString, IsNotEmpty, IsEnum, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeviceType, DeviceStatus } from '@app/database';

export class CreateDeviceDto {
  @ApiProperty({ example: 'Sensor Sala Principal', description: 'Nombre del dispositivo' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: DeviceType, example: DeviceType.MULTI_SENSOR })
  @IsEnum(DeviceType)
  type: DeviceType;

  @ApiPropertyOptional({ enum: DeviceStatus, example: DeviceStatus.ACTIVE })
  @IsEnum(DeviceStatus)
  @IsOptional()
  status?: DeviceStatus;

  @ApiPropertyOptional({ example: 'Edificio A, Piso 2' })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({ example: { firmware: '1.0.2', model: 'DHT22' } })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
