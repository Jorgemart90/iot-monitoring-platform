import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, Cpu } from 'lucide-react';
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
import { devicesApi, type CreateDeviceRequest } from '@/api/devices.api';
import { UserRole, DeviceStatus } from '@/types';
import type { Device } from '@/types';

const LIMIT = 10;

const STATUS_VARIANT: Record<DeviceStatus, 'success' | 'secondary' | 'warning'> = {
  [DeviceStatus.ACTIVE]: 'success',
  [DeviceStatus.INACTIVE]: 'secondary',
  [DeviceStatus.MAINTENANCE]: 'warning',
};

const STATUS_LABEL: Record<DeviceStatus, string> = {
  [DeviceStatus.ACTIVE]: 'Activo',
  [DeviceStatus.INACTIVE]: 'Inactivo',
  [DeviceStatus.MAINTENANCE]: 'Mantenimiento',
};

const EMPTY_FORM: CreateDeviceRequest = {
  name: '',
  type: '',
  location: '',
  status: DeviceStatus.ACTIVE,
  mqttTopic: '',
};

export function DevicesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === UserRole.ADMIN;

  const [devices, setDevices] = useState<Device[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [form, setForm] = useState<CreateDeviceRequest>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirm state
  const [deletingDevice, setDeletingDevice] = useState<Device | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const fetchDevices = useCallback(async (p: number) => {
    setIsLoading(true);
    try {
      const { data } = await devicesApi.findAll(p, LIMIT);
      setDevices(data.data);
      setTotal(data.total);
    } catch {
      toast({ variant: 'destructive', title: 'Error al cargar dispositivos' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchDevices(page);
  }, [fetchDevices, page]);

  // Open create modal
  const openCreate = () => {
    setEditingDevice(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setIsModalOpen(true);
  };

  // Open edit modal
  const openEdit = (device: Device) => {
    setEditingDevice(device);
    setForm({
      name: device.name,
      type: device.type,
      location: device.location,
      status: device.status,
      mqttTopic: device.mqttTopic,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  // Submit create/edit
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSaving(true);
    try {
      if (editingDevice) {
        await devicesApi.update(editingDevice.id, form);
        toast({ title: 'Dispositivo actualizado correctamente' });
      } else {
        await devicesApi.create(form);
        toast({ title: 'Dispositivo creado correctamente' });
      }
      setIsModalOpen(false);
      await fetchDevices(page);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Error al guardar el dispositivo';
      setFormError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Confirm delete
  const handleDelete = async () => {
    if (!deletingDevice) return;
    setIsDeleting(true);
    try {
      await devicesApi.remove(deletingDevice.id);
      toast({ title: `"${deletingDevice.name}" eliminado` });
      setDeletingDevice(null);
      const newPage = devices.length === 1 && page > 1 ? page - 1 : page;
      setPage(newPage);
      await fetchDevices(newPage);
    } catch {
      toast({ variant: 'destructive', title: 'Error al eliminar el dispositivo' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Dispositivos IoT</h3>
          <p className="text-sm text-muted-foreground">
            {total} dispositivo{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Nuevo dispositivo
          </Button>
        )}
      </div>

      {/* Table card */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Cpu className="mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm">Sin dispositivos registrados</p>
              {isAdmin && (
                <Button variant="link" size="sm" onClick={openCreate} className="mt-2">
                  Crear el primero
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Tipo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Ubicación
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Topic MQTT
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Última vez
                    </th>
                    {isAdmin && (
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                        Acciones
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device) => (
                    <tr key={device.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{device.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{device.type}</td>
                      <td className="px-4 py-3 text-muted-foreground">{device.location}</td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[device.status]}>
                          {STATUS_LABEL[device.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {device.mqttTopic}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {device.lastSeenAt
                          ? new Date(device.lastSeenAt).toLocaleString('es-ES', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                          : '—'}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(device)}
                              title="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeletingDevice(device)}
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

        {/* Pagination */}
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
      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!isSaving) setIsModalOpen(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingDevice ? 'Editar dispositivo' : 'Nuevo dispositivo'}
            </DialogTitle>
            <DialogDescription>
              {editingDevice
                ? 'Modifica los datos del dispositivo seleccionado.'
                : 'Registra un nuevo dispositivo IoT en la plataforma.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="d-name">Nombre *</Label>
              <Input
                id="d-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Sensor temperatura sala 1"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="d-type">Tipo *</Label>
                <Input
                  id="d-type"
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  placeholder="temperature-sensor"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="d-location">Ubicación *</Label>
                <Input
                  id="d-location"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="Sala de servidores"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="d-status">Estado</Label>
                <select
                  id="d-status"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value as DeviceStatus }))
                  }
                >
                  <option value={DeviceStatus.ACTIVE}>Activo</option>
                  <option value={DeviceStatus.INACTIVE}>Inactivo</option>
                  <option value={DeviceStatus.MAINTENANCE}>Mantenimiento</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="d-topic">Topic MQTT *</Label>
                <Input
                  id="d-topic"
                  value={form.mqttTopic}
                  onChange={(e) => setForm((f) => ({ ...f, mqttTopic: e.target.value }))}
                  placeholder="iot/devices/sensor-1/data"
                  required
                />
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
                {isSaving ? 'Guardando…' : editingDevice ? 'Guardar cambios' : 'Crear dispositivo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deletingDevice}
        onOpenChange={(open) => { if (!open && !isDeleting) setDeletingDevice(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar dispositivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar <strong>{deletingDevice?.name}</strong>. Esta acción no se
              puede deshacer y eliminará también todas las lecturas asociadas.
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
