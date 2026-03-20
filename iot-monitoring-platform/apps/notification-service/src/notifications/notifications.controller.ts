import {
  Controller,
  Get,
  Sse,
  Req,
  Res,
  MessageEvent,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Observable, fromEvent } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { SseService } from '../sse/sse.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly sseService: SseService) {}

  @Get('stream')
  @Sse()
  @ApiOperation({ summary: 'Suscribirse a notificaciones de alertas en tiempo real (SSE)' })
  @ApiResponse({ status: 200, description: 'Stream SSE de alertas disparadas' })
  stream(@Req() req: Request, @Res() res: Response): Observable<MessageEvent> {
    const clientId = uuidv4();
    const subject = this.sseService.addClient(clientId);

    req.on('close', () => {
      this.sseService.removeClient(clientId);
    });

    return subject.asObservable().pipe(
      map((event) => ({
        id: event.id,
        type: event.type || 'message',
        data: JSON.stringify(event.data),
      })),
    );
  }

  @Get('status')
  @ApiOperation({ summary: 'Obtener estado del servicio de notificaciones' })
  @ApiResponse({ status: 200, description: 'Estado del servicio' })
  status() {
    return {
      status: 'ok',
      connectedClients: this.sseService.getConnectedClientsCount(),
      timestamp: new Date().toISOString(),
      service: 'notification-service',
    };
  }
}
