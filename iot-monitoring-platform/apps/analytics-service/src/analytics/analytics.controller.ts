import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AuthUser, CurrentUser, PaginationDto } from '@app/common';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('devices/:id/metrics')
  @ApiOperation({
    summary: 'Obtener métricas agregadas de un dispositivo (desde Redis)',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Métricas del dispositivo (avg, min, max por campo)',
  })
  getMetrics(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.analyticsService.getMetrics(id, user);
  }

  @Get('devices/:id/readings')
  @ApiOperation({
    summary: 'Obtener lecturas históricas de un dispositivo (paginado)',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Lecturas paginadas del dispositivo',
  })
  getReadings(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() paginationDto: PaginationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.analyticsService.getReadings(id, paginationDto, user);
  }
}
