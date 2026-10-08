import { AlertQueryDto } from './dto/alert-query.dto';
import { Controller, Get, Patch, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { AuthUser, CurrentUser, PaginationDto } from '@app/common';

@ApiTags('alerts')
@ApiBearerAuth()
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas las alertas disparadas (paginado)' })
  @ApiResponse({ status: 200, description: 'Lista paginada de alertas' })
  findAll(@Query() paginationDto: AlertQueryDto, @CurrentUser() user: AuthUser) {
    return this.alertsService.findAll(paginationDto, user);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Total de alertas pendientes por severidad, sin paginación' })
  @ApiResponse({
    status: 200,
    schema: { example: { total: 4, bySeverity: { LOW: 1, MEDIUM: 1, HIGH: 1, CRITICAL: 1 } } },
  })
  summary(@CurrentUser() user: AuthUser) {
    return this.alertsService.summary(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener alerta por ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.alertsService.findOne(id, user);
  }

  @Patch(':id/acknowledge')
  @ApiOperation({ summary: 'Marcar alerta como reconocida' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Alerta reconocida' })
  acknowledge(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.alertsService.acknowledge(id, user);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Marcar alerta como resuelta' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Alerta resuelta' })
  resolve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.alertsService.resolve(id, user);
  }
}
