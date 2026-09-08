import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, ShieldAlert, Power } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { alertRulesApi, type CreateRuleRequest } from '@/api/alerts.api';
import { devicesApi } from '@/api/devices.api';
import { UserRole, AlertSeverity, RuleCondition } from '@/types';
import type { AlertRule, Device } from '@/types';

const LIMIT = 10;

const CONDITION_LABEL: Record<RuleCondition, string> = {
  [RuleCondition.GREATER_THAN]: 'Mayor que (>)',
  [RuleCondition.LESS_THAN]: 'Menor que (<)',
  [RuleCondition.EQUALS]: 'Igual a (=)',
  [RuleCondition.BETWEEN]: 'Entre (rango)',
};

const CONDITION_SYMBOL: Record<RuleCondition, string> = {
  [RuleCondition.GREATER_THAN]: '>',
  [RuleCondition.LESS_THAN]: '<',
  [RuleCondition.EQUALS]: '=',
  [RuleCondition.BETWEEN]: '↔',
};

const SEVERITY_VARIANT: Record<AlertSeverity, 'secondary' | 'warning' | 'default' | 'destructive'> = {
  [AlertSeverity.LOW]: 'secondary',
  [AlertSeverity.MEDIUM]: 'warning',
  [AlertSeverity.HIGH]: 'default',
  [AlertSeverity.CRITICAL]: 'destructive',
};

const EMPTY_FORM: CreateRuleRequest = {
  name: '',
  metricField: '',
  condition: RuleCondition.GREATER_THAN,
  threshold: 0,
  thresholdMax: undefined,
  severity: AlertSeverity.MEDIUM,
  deviceId: undefined,
  isActive: true,
};

function formatCondition(rule: AlertRule): string {
  if (rule.condition === RuleCondition.BETWEEN) {
    return `${rule.threshold} ↔ ${rule.thresholdMax ?? '?'}`;
  }
  return `${CONDITION_SYMBOL[rule.condition]} ${rule.threshold}`;
}

export function RulesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === UserRole.ADMIN;

  const [rules, setRules] = useState<AlertRule[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Devices for the form selector
  const [devices, setDevices] = useState<Device[]>([]);

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [form, setForm] = useState<CreateRuleRequest>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Delete state
  const [deletingRule, setDeletingRule] = useState<AlertRule | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toggle active state
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const fetchRules = useCallback(
    async (p: number) => {
      setIsLoading(true);
      try {
        const { data } = await alertRulesApi.findAll(p, LIMIT);
        setRules(data.data);
        setTotal(data.total);
      } catch {
        toast({ variant: 'destructive', title: 'Error al cargar reglas' });
      } finally {
        setIsLoading(false);
      }
    },
    [toast],
  );

  const fetchDevices = useCallback(async () => {
    try {
      const { data } = await devicesApi.findAll(1, 100);
      setDevices(data.data);
    } catch {
      // Silent — devices may not be available
    }
  }, []);

  useEffect(() => {
    void fetchRules(page);
    void fetchDevices();
  }, [fetchRules, fetchDevices, page]);

  const openCreate = () => {
    setEditingRule(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEdit = (rule: AlertRule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      metricField: rule.metricField,
      condition: rule.condition,
      threshold: Number(rule.threshold),
      thresholdMax: rule.thresholdMax ? Number(rule.thresholdMax) : undefined,
      severity: rule.severity,
      deviceId: rule.deviceId ?? undefined,
      isActive: rule.isActive,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSaving(true);
    try {
      const payload: CreateRuleRequest = {
        ...form,
        threshold: Number(form.threshold),
        thresholdMax:
          form.condition === RuleCondition.BETWEEN && form.thresholdMax !== undefined
            ? Number(form.thresholdMax)
            : undefined,
        deviceId: form.deviceId || undefined,
      };
      if (editingRule) {
        await alertRulesApi.update(editingRule.id, payload);
        toast({ title: 'Regla actualizada correctamente' });
      } else {
        await alertRulesApi.create(payload);
        toast({ title: 'Regla creada correctamente' });
      }
      setIsModalOpen(false);
      await fetchRules(page);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Error al guardar la regla';
      setFormError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingRule) return;
    setIsDeleting(true);
    try {
      await alertRulesApi.remove(deletingRule.id);
      toast({ title: `"${deletingRule.name}" eliminada` });
      setDeletingRule(null);
      const newPage = rules.length === 1 && page > 1 ? page - 1 : page;
      setPage(newPage);
      await fetchRules(newPage);
    } catch {
      toast({ variant: 'destructive', title: 'Error al eliminar la regla' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleActive = async (rule: AlertRule) => {
    setTogglingId(rule.id);
    try {
      await alertRulesApi.update(rule.id, { isActive: !rule.isActive });
      toast({
        title: rule.isActive ? `"${rule.name}" desactivada` : `"${rule.name}" activada`,
      });
      await fetchRules(page);
    } catch {
      toast({ variant: 'destructive', title: 'Error al cambiar estado de la regla' });
    } finally {
      setTogglingId(null);
    }
  };

  const deviceName = (deviceId?: string) => {
    if (!deviceId) return 'Todos los dispositivos';
    return devices.find((d) => d.id === deviceId)?.name ?? deviceId.slice(0, 8) + '…';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Reglas de alerta</h3>
          <p className="text-sm text-muted-foreground">
            {total} regla{total !== 1 ? 's' : ''} configurada{total !== 1 ? 's' : ''}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Nueva regla
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <ShieldAlert className="mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm">Sin reglas configuradas</p>
              {isAdmin && (
                <Button variant="link" size="sm" onClick={openCreate} className="mt-2">
                  Crear la primera
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    {['Nombre', 'Dispositivo', 'Métrica', 'Condición', 'Severidad', 'Estado'].map(
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
                  {rules.map((rule) => (
                    <tr key={rule.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="font-medium">{rule.name}</div>
                        {rule.description && (
                          <div className="text-xs text-muted-foreground">{rule.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {deviceName(rule.deviceId)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{rule.metricField}</td>
                      <td className="px-4 py-3 font-mono text-xs">{formatCondition(rule)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={SEVERITY_VARIANT[rule.severity]}>{rule.severity}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={rule.isActive ? 'success' : 'secondary'}>
                          {rule.isActive ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title={rule.isActive ? 'Desactivar' : 'Activar'}
                              disabled={togglingId === rule.id}
                              onClick={() => void handleToggleActive(rule)}
                            >
                              <Power
                                className={`h-3.5 w-3.5 ${rule.isActive ? 'text-green-500' : 'text-muted-foreground'}`}
                              />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(rule)}
                              title="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeletingRule(rule)}
                              title="Eliminar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
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
              Página {page} de {totalPages} · {total} resultados
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

      {/* Create / Edit Modal */}
      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          if (!isSaving) setIsModalOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Editar regla' : 'Nueva regla de alerta'}</DialogTitle>
            <DialogDescription>
              {editingRule
                ? 'Modifica los parámetros de la regla.'
                : 'Define las condiciones para disparar una alerta automática.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {/* Name */}
            <div className="space-y-1">
              <Label htmlFor="r-name">Nombre *</Label>
              <Input
                id="r-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Temperatura alta en sala"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <Label htmlFor="r-desc">Descripción</Label>
              <Input
                id="r-desc"
                value={(form as CreateRuleRequest & { description?: string }).description ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value } as typeof f))
                }
                placeholder="Descripción opcional"
              />
            </div>

            {/* Device */}
            <div className="space-y-1">
              <Label htmlFor="r-device">Dispositivo</Label>
              <select
                id="r-device"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={form.deviceId ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, deviceId: e.target.value || undefined }))
                }
              >
                <option value="">Todos los dispositivos</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Metric + Condition row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="r-metric">Campo de métrica *</Label>
                <Input
                  id="r-metric"
                  value={form.metricField}
                  onChange={(e) => setForm((f) => ({ ...f, metricField: e.target.value }))}
                  placeholder="temperature"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="r-condition">Condición *</Label>
                <select
                  id="r-condition"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={form.condition}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, condition: e.target.value as RuleCondition }))
                  }
                >
                  {Object.values(RuleCondition).map((c) => (
                    <option key={c} value={c}>
                      {CONDITION_LABEL[c]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Threshold(s) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="r-threshold">
                  {form.condition === RuleCondition.BETWEEN ? 'Umbral mínimo *' : 'Umbral *'}
                </Label>
                <Input
                  id="r-threshold"
                  type="number"
                  step="any"
                  value={form.threshold}
                  onChange={(e) => setForm((f) => ({ ...f, threshold: Number(e.target.value) }))}
                  required
                />
              </div>
              {form.condition === RuleCondition.BETWEEN && (
                <div className="space-y-1">
                  <Label htmlFor="r-threshold-max">Umbral máximo *</Label>
                  <Input
                    id="r-threshold-max"
                    type="number"
                    step="any"
                    value={form.thresholdMax ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, thresholdMax: Number(e.target.value) }))
                    }
                    required
                  />
                </div>
              )}
            </div>

            {/* Severity + Active row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="r-severity">Severidad *</Label>
                <select
                  id="r-severity"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={form.severity}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, severity: e.target.value as AlertSeverity }))
                  }
                >
                  {Object.values(AlertSeverity).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <input
                  id="r-active"
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={form.isActive ?? true}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                <Label htmlFor="r-active">Regla activa</Label>
              </div>
            </div>

            {formError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Guardando…' : editingRule ? 'Guardar cambios' : 'Crear regla'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deletingRule}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeletingRule(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar regla?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar <strong>{deletingRule?.name}</strong>. Esta acción no se
              puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
