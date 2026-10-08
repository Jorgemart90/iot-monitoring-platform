import { IsISO8601, IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class HistoryQueryDto {
  @ApiProperty({ description: 'Inicio inclusivo ISO 8601' })
  @IsISO8601({ strict: true })
  from: string;
  @ApiProperty({ description: 'Fin exclusivo ISO 8601' })
  @IsISO8601({ strict: true })
  to: string;
  @ApiPropertyOptional({ default: 240, minimum: 10, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(500)
  points?: number = 240;
}
