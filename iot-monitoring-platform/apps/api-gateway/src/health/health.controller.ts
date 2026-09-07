import { Controller, Get } from '@nestjs/common';
import { Public } from '@app/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @Public()
  @ApiOperation({ summary: 'Verificar estado del API Gateway' })
  @ApiResponse({
    status: 200,
    description: 'Servicio funcionando correctamente',
  })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'api-gateway',
      version: '1.0.0',
    };
  }
}
