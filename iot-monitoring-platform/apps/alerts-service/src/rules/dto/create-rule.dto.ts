import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AlertCondition, AlertSeverity } from '@app/database';

export class CreateRuleDto {
  @ApiProperty({ example: 'Temperatura Alta' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Alerta cuando temperatura supera 35°C' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'UUID del dispositivo (null = todos)', example: null })
  @IsUUID()
  @IsOptional()
  deviceId?: string;

  @ApiProperty({ example: 'temperature', description: 'Campo del sensor a evaluar' })
  @IsString()
  @IsNotEmpty()
  metricField: string;

  @ApiProperty({ enum: AlertCondition, example: AlertCondition.GREATER_THAN })
  @IsEnum(AlertCondition)
  condition: AlertCondition;

  @ApiProperty({ example: 35.0 })
  @IsNumber()
  threshold: number;

  @ApiPropertyOptional({ example: 40.0, description: 'Umbral máximo para condición BETWEEN' })
  @IsNumber()
  @IsOptional()
  thresholdMax?: number;

  @ApiProperty({ enum: AlertSeverity, example: AlertSeverity.HIGH })
  @IsEnum(AlertSeverity)
  severity: AlertSeverity;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
