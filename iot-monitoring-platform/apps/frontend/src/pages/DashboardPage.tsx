import { useEffect, useState, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Cpu, Bell, AlertTriangle, Activity, Wifi, WifiOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { devicesApi } from '@/api/devices.api';
import { alertsApi } from '@/api/alerts.api';
import { useSSE } from '@/hooks/useSSE';
import { AlertSeverity, AlertStatus, DeviceStatus } from '@/types';
import type { Alert } from '@/types';

interface DashboardStats {
  totalDevices: number;
  activeDevices: number;
  openAlerts: number;
  criticalAlerts: number;
}

interface SeverityCount {
  severity: string;
  count: number;
}

const SEVERITY_VARIANT: Record<AlertSeverity, 'secondary' | 'warning' | 'default' | 'destructive'> = {
  [AlertSeverity.LOW]: 'secondary',
  [AlertSeverity.MEDIUM]: 'warning',
  [AlertSeverity.HIGH]: 'default',
  [AlertSeverity.CRITICAL]: 'destructive',
};

const STATUS_VARIANT: Record<AlertStatus, 'warning' | 'secondary' | 'success'> = {
  [AlertStatus.OPEN]: 'warning',
  [AlertStatus.ACKNOWLEDGED]: 'secondary',
  [AlertStatus.RESOLVED]: 'success',
};

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalDevices: 0,
    activeDevices: 0,
    openAlerts: 0,
    criticalAlerts: 0,
  });
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [severityChart, setSeverityChart] = useState<SeverityCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { events, isConnected } = useSSE('/api/v1/notifications/stream');

  const fetchStats = useCallback(async () => {
    try {
      const [devicesRes, alertsRes] = await Promise.all([
        devicesApi.findAll(1, 100),
        alertsApi.findAll(1, 100),
      ]);

      const devices = devicesRes.data.data;
      const alerts = alertsRes.data.data;

      const activeDevices = devices.filter((d) => d.status === DeviceStatus.ACTIVE).length;
      const openAlerts = alerts.filter((a) => a.status === AlertStatus.OPEN).length;
      const criticalAlerts = alerts.filter(
        (a) => a.severity === AlertSeverity.CRITICAL && a.status === AlertStatus.OPEN,
      ).length;

      const dist = alerts.reduce<Record<string, number>>((acc, a) => {
        acc[a.severity] = (acc[a.severity] ?? 0) + 1;
        return acc;
      }, {});
      const chartData = Object.entries(dist).map(([severity, count]) => ({ severity, count }));

      setStats({ totalDevices: devicesRes.data.total, activeDevices, openAlerts, criticalAlerts });
      setRecentAlerts(alerts.slice(0, 5));
      setSeverityChart(chartData);
    } catch {
      // Silent — backend may not be running in all envs
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
    const interval = setInterval(() => void fetchStats(), 30_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const statCards = [
    { title: 'Total dispositivos', value: stats.totalDevices, icon: Cpu, color: 'text-blue-500' },
    {
      title: 'Dispositivos activos',
      value: stats.activeDevices,
      icon: Activity,
      color: 'text-green-500',
    },
    {
      title: 'Alertas abiertas',
      value: stats.openAlerts,
      icon: Bell,
      color: 'text-yellow-500',
    },
    {
      title: 'Alertas críticas',
      value: stats.criticalAlerts,
      icon: AlertTriangle,
      color: 'text-red-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(({ title, value, icon: Icon, color }) => (
          <Card key={title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
              <Icon className={`h-5 w-5 ${color}`} />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-8 w-16 animate-pulse rounded bg-muted" />
              ) : (
                <div className="text-2xl font-bold">{value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts + SSE feed */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Severity distribution chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alertas por severidad</CardTitle>
          </CardHeader>
          <CardContent>
            {severityChart.length === 0 ? (
              <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                Sin alertas registradas
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={severityChart} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="severity" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    formatter={(v) => [v, 'Alertas']}
                  />
                  <Bar
                    dataKey="count"
                    fill="hsl(221.2 83.2% 53.3%)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* SSE live feed */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Feed en tiempo real</CardTitle>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {isConnected ? (
                <>
                  <Wifi className="h-3.5 w-3.5 text-green-500" />
                  <span>Conectado</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5 text-red-400" />
                  <span>Desconectado</span>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] space-y-1 overflow-y-auto">
              {events.length === 0 ? (
                <p className="pt-16 text-center text-sm text-muted-foreground">
                  Esperando eventos de alerta…
                </p>
              ) : (
                events.slice(0, 30).map((ev, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-xs"
                  >
                    <Bell className="mt-0.5 h-3 w-3 shrink-0 text-yellow-500" />
                    <span className="break-all font-mono leading-relaxed">
                      {typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent alerts table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alertas recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentAlerts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {isLoading ? 'Cargando…' : 'Sin alertas registradas'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Regla</th>
                    <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">
                      Dispositivo
                    </th>
                    <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">
                      Severidad
                    </th>
                    <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Estado</th>
                    <th className="pb-2 text-xs font-medium text-muted-foreground">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAlerts.map((alert) => (
                    <tr key={alert.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{alert.ruleName ?? alert.ruleId}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {alert.deviceName ?? alert.deviceId}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant={SEVERITY_VARIANT[alert.severity]}>
                          {alert.severity}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant={STATUS_VARIANT[alert.status]}>
                          {alert.status}
                        </Badge>
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {new Date(alert.triggeredAt).toLocaleString('es-ES', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
