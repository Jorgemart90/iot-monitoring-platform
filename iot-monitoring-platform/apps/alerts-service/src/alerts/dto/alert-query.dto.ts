import { IsOptional, IsISO8601, IsUUID, IsString, MaxLength, IsEnum, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@app/common';
import { AlertStatus, AlertSeverity } from '@app/database';
export class AlertQueryDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsISO8601({ strict: true }) from?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601({ strict: true }) to?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() deviceId?: string;
  @ApiPropertyOptional({ description: 'Ubicación/zona exacta; __none__ para sin zona' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  zone?: string;
  @ApiPropertyOptional({ enum: AlertSeverity })
  @IsOptional()
  @IsEnum(AlertSeverity)
  severity?: AlertSeverity;
  @ApiPropertyOptional({ enum: AlertStatus })
  @IsOptional()
  @IsEnum(AlertStatus)
  status?: AlertStatus;
  @ApiPropertyOptional({ enum: ['temperature', 'humidity', 'pressure'] })
  @IsOptional()
  @IsIn(['temperature', 'humidity', 'pressure'])
  metricField?: string;
}
