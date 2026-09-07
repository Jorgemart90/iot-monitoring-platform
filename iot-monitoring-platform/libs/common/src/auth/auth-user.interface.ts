import { UserRole } from '@app/database';

export interface AuthUser {
  userId: string;
  username: string;
  role: UserRole;
  sessionId: string;
}
