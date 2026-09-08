import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/types';

export function Header({ title }: { title?: string }) {
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN;

  return (
    <header className="flex h-14 items-center justify-between border-b px-6">
      <h2 className="text-lg font-semibold">{title ?? 'Panel de control'}</h2>
      <Badge variant={isAdmin ? 'default' : 'secondary'}>
        {isAdmin ? 'Admin' : 'Viewer'}
      </Badge>
    </header>
  );
}
