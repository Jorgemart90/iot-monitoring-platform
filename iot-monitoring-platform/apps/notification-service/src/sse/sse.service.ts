import { Injectable, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';

export interface SseEvent {
  id?: string;
  data: Record<string, any>;
  type?: string;
}

@Injectable()
export class SseService {
  private readonly logger = new Logger(SseService.name);
  private clients = new Map<string, Subject<SseEvent>>();

  addClient(clientId: string): Subject<SseEvent> {
    const subject = new Subject<SseEvent>();
    this.clients.set(clientId, subject);
    this.logger.log(`SSE client connected: ${clientId} (total: ${this.clients.size})`);
    return subject;
  }

  removeClient(clientId: string): void {
    const subject = this.clients.get(clientId);
    if (subject) {
      subject.complete();
      this.clients.delete(clientId);
      this.logger.log(`SSE client disconnected: ${clientId} (total: ${this.clients.size})`);
    }
  }

  emit(event: SseEvent): void {
    this.clients.forEach((subject, clientId) => {
      try {
        subject.next(event);
      } catch (error) {
        this.logger.error(`Failed to emit to client ${clientId}`, error);
        this.removeClient(clientId);
      }
    });
  }

  getConnectedClientsCount(): number {
    return this.clients.size;
  }
}
