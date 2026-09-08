import { useEffect, useState, useCallback } from 'react';
import { Bell, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { alertsApi } from '@/api/alerts.api';
import { UserRole, AlertSeverity, AlertStatus } from '@/types';
import type { Alert } from '@/types';

const LIMIT = 20;

type FilterStatus = 'all' | AlertStatus;

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

const STATUS_LABEL: Record<AlertStatus, string> = {
  [AlertStatus.OPEN]: 'Abierta',
  [AlertStatus.ACKNOWLEDGED]: 'Reconocida',
  [AlertStatus.RESOLVED]: 'Resuelta',
};

const FILTER_TABS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: AlertStatus.OPEN, label: 'Abiertas' },
  { value: AlertStatus.ACKNOWLEDGED, label: 'Reconocidas' },
  { value: AlertStatus.RESOLVED, label: 'Resueltas' },
];

export function AlertsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === UserRole.ADMIN;

  const [allAlerts, setAllAlerts] = useState<Alert[]>([]);
  const [totalFromApi, setTotalFromApi] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');

  const [actioningId, setActioningId] = useState<string | null>(null);

  const fetchAlerts = useCallback(
    async (p: number) => {
      setIsLoading(true);
      try {
        const { data } = await alertsApi.findAll(p, LIMIT);
        setAllAlerts(data.data);
        setTotalFromApi(data.total);
      } catch {
        toast({ variant: 'destructive', title: 'Error al cargar alertas' });
      } finally {
        setIsLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void fetchAlerts(page);
  }, [fetchAlerts, page]);

  const filtered = filter === 'all' ? allAlerts : allAlerts.filter((a) => a.status === filter);

  const counts = {
    all: totalFromApi,
    [AlertStatus.OPEN]: allAlerts.filter((a) => a.status === AlertStatus.OPEN).length,
    [AlertStatus.ACKNOWLEDGED]: allAlerts.filter((a) => a.status === AlertStatus.ACKNOWLEDGED)
      .length,
    [AlertStatus.RESOLVED]: allAlerts.filter((a) => a.status === AlertStatus.RESOLVED).length,
  };

  const handleAcknowledge = async (alert: Alert) => {
    setActioningId(alert.id);
    try {
      await alertsApi.acknowledge(alert.id);
      toast({ title: `Alerta reconocida` });
      await fetchAlerts(page);
    } catch {
      toast({ variant: 'destructive', title: 'Error al reconocer la alerta' });
    } finally {
      setActioningId(null);
    }
  };

  const handleResolve = async (alert: Alert) => {
    setActioningId(alert.id);
    try {
      await alertsApi.resolve(alert.id);
      toast({ title: `Alerta resuelta` });
      await fetchAlerts(page);
    } catch {
      toast({ variant: 'destructive', title: 'Error al resolver la alerta' });
    } finally {
      setActioningId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalFromApi / LIMIT));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium">Alertas</h3>
        <p className="text-sm text-muted-foreground">
          Historial de alertas disparadas por las reglas activas.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            {label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                filter === value ? 'bg-primary-foreground/20' : 'bg-background'
              }`}
            >
              {counts[value as keyof typeof counts] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Bell className="mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm">
                {filter === 'all' ? 'Sin alertas registradas' : `Sin alertas ${STATUS_LABEL[filter as AlertStatus]?.toLowerCase() ?? ''}`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    {['Regla', 'Dispositivo', 'Métrica', 'Valor', 'Severidad', 'Estado', 'Fecha'].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-medium text-muted-foreground"
                        >
                          {h}
                        </th>
                      ),
                    )}
                    {isAdmin && (
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                        Acciones
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((alert) => (
                    <tr key={alert.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="font-medium">{alert.ruleName ?? alert.ruleId}</div>
                        {alert.message && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {alert.message}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {alert.deviceName ?? alert.deviceId}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{alert.metricField}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {alert.triggerValue} / {alert.threshold}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={SEVERITY_VARIANT[alert.severity]}>
                          {alert.severity}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[alert.status]}>
                          {STATUS_LABEL[alert.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(alert.triggeredAt).toLocaleString('es-ES', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {alert.status === AlertStatus.OPEN && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-yellow-600 hover:text-yellow-700"
                                title="Reconocer"
                                disabled={actioningId === alert.id}
                                onClick={() => void handleAcknowledge(alert)}
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {(alert.status === AlertStatus.OPEN ||
                              alert.status === AlertStatus.ACKNOWLEDGED) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600 hover:text-green-700"
                                title="Resolver"
                                disabled={actioningId === alert.id}
                                onClick={() => void handleResolve(alert)}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Página {page} de {totalPages} · {totalFromApi} en total
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
