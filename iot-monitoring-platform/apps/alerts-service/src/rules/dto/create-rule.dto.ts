import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsUUID,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ArrayUnique,
  MaxLength,
  Matches,
  IsIn,
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

  @ApiPropertyOptional({
    description: 'Zona actual de los sensores. Cadena vacía = sin zona',
    maxLength: 150,
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  zone?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'UUID de uno o varios sensores de la zona. Sin lista = toda la zona',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  deviceIds?: string[];

  @ApiPropertyOptional({
    maxLength: 500,
    description: 'Mensaje literal que se conserva en cada alerta',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  customMessage?: string;

  @ApiPropertyOptional({ example: '#db6a32', description: 'Color hexadecimal RGB' })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string;

  @ApiProperty({ example: 'temperature', description: 'Campo del sensor a evaluar' })
  @IsString()
  @IsNotEmpty()
  @IsIn(['temperature', 'humidity', 'pressure'])
  metricField: string;

  @ApiProperty({ enum: AlertCondition, example: AlertCondition.GREATER_THAN })
  @IsEnum(AlertCondition)
  condition: AlertCondition;

  @ApiProperty({ example: 35.0 })
  @IsNumber()
  threshold: number;

  @ApiPropertyOptional({
    example: 40.0,
    description: 'Límite superior para BETWEEN u OUTSIDE_RANGE, mayor que threshold',
  })
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
