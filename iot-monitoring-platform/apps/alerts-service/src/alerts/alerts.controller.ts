import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { PaginationDto } from '@app/common';

@ApiTags('alerts')
@ApiBearerAuth()
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas las alertas disparadas (paginado)' })
  @ApiResponse({ status: 200, description: 'Lista paginada de alertas' })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.alertsService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener alerta por ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.alertsService.findOne(id);
  }

  @Patch(':id/acknowledge')
  @ApiOperation({ summary: 'Marcar alerta como reconocida' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Alerta reconocida' })
  acknowledge(@Param('id', ParseUUIDPipe) id: string) {
    return this.alertsService.acknowledge(id);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Marcar alerta como resuelta' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Alerta resuelta' })
  resolve(@Param('id', ParseUUIDPipe) id: string) {
    return this.alertsService.resolve(id);
  }
}
