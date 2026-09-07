import { Injectable, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';
import { AuthUser } from '@app/common';
import { UserRole } from '@app/database';

export interface SseEvent {
  id?: string;
  data: Record<string, any>;
  type?: string;
}

@Injectable()
export class SseService {
  private readonly logger = new Logger(SseService.name);
  private clients = new Map<string, { subject: Subject<SseEvent>; user: AuthUser }>();

  addClient(clientId: string, user: AuthUser): Subject<SseEvent> {
    const subject = new Subject<SseEvent>();
    this.clients.set(clientId, { subject, user });
    this.logger.log(`SSE client connected: ${clientId} (total: ${this.clients.size})`);
    return subject;
  }

  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.subject.complete();
      this.clients.delete(clientId);
      this.logger.log(`SSE client disconnected: ${clientId} (total: ${this.clients.size})`);
    }
  }

  emit(event: SseEvent): void {
    this.clients.forEach((client, clientId) => {
      try {
        if (client.user.role === UserRole.MASTER || event.data.ownerId === client.user.userId) {
          client.subject.next(event);
        }
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
