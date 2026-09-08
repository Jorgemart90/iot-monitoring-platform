import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Cpu,
  Bell,
  BarChart3,
  ShieldAlert,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, adminOnly: false },
  { to: '/alerts', label: 'Alertas', icon: Bell, adminOnly: false },
  { to: '/devices', label: 'Dispositivos', icon: Cpu, adminOnly: true },
  { to: '/rules', label: 'Reglas', icon: ShieldAlert, adminOnly: true },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN;

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-card px-3 py-4">
      {/* Brand */}
      <div className="mb-4 px-3">
        <h1 className="text-lg font-bold text-primary">IoT Monitor</h1>
        <p className="text-xs text-muted-foreground">Plataforma de monitoreo</p>
      </div>

      <Separator className="mb-4" />

      {/* Nav links */}
      <nav className="flex-1 space-y-1">
        {navItems
          .filter((item) => !item.adminOnly || isAdmin)
          .map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
      </nav>

      <Separator className="my-4" />

      {/* User info + logout */}
      <div className="px-3">
        <p className="mb-1 truncate text-sm font-medium">{user?.name}</p>
        <p className="mb-3 truncate text-xs text-muted-foreground">{user?.email}</p>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={logout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>
    </aside>
  );
}
