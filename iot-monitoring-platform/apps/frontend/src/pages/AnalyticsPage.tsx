import { useEffect, useState, useCallback } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { devicesApi } from '@/api/devices.api';
import { analyticsApi } from '@/api/analytics.api';
import type { Device, MetricData, DeviceReading } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReadingPoint {
  time: string;
  fullTime: string;
  value: number;
  unit: string;
  metricType: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const LINE_COLORS = [
  'hsl(221.2 83.2% 53.3%)',
  'hsl(142.1 76.2% 36.3%)',
  'hsl(24.6 95% 53.1%)',
  'hsl(291 47.4% 51.2%)',
  'hsl(0 72.2% 50.6%)',
];

const ALL_METRICS = '__all__';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function trend(avg: number, lastValue: number): 'up' | 'down' | 'flat' {
  const diff = lastValue - avg;
  if (Math.abs(diff) < avg * 0.02) return 'flat';
  return diff > 0 ? 'up' : 'down';
}

function TrendIcon({ direction }: { direction: 'up' | 'down' | 'flat' }) {
  if (direction === 'up') return <TrendingUp className="h-4 w-4 text-red-500" />;
  if (direction === 'down') return <TrendingDown className="h-4 w-4 text-green-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricSparkCard({
  metric,
  readings,
  color,
  onClick,
}: {
  metric: MetricData;
  readings: ReadingPoint[];
  color: string;
  onClick: () => void;
}) {
  const direction = trend(metric.avg, metric.lastValue);

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <CardTitle className="text-sm font-medium">{metric.field}</CardTitle>
        <div className="flex items-center gap-1.5">
          <TrendIcon direction={direction} />
          <Badge variant="secondary" className="text-[10px]">
            {metric.unit}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="mb-2 text-2xl font-bold">
          {Number(metric.lastValue).toFixed(2)}
          <span className="ml-1 text-sm font-normal text-muted-foreground">{metric.unit}</span>
        </div>
        <div className="mb-2 grid grid-cols-3 gap-1 text-xs text-muted-foreground">
          <span>↓ {Number(metric.min).toFixed(1)}</span>
          <span className="text-center">~ {Number(metric.avg).toFixed(1)}</span>
          <span className="text-right">↑ {Number(metric.max).toFixed(1)}</span>
        </div>
        {readings.length > 0 ? (
          <ResponsiveContainer width="100%" height={56}>
            <AreaChart data={readings} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${metric.field}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={1.5}
                fill={`url(#grad-${metric.field})`}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-14 items-center justify-center text-xs text-muted-foreground">
            Sin lecturas
          </div>
        )}
        <p className="mt-1 text-right text-[10px] text-muted-foreground">
          {readings.length} lectura{readings.length !== 1 ? 's' : ''} · click para detalle
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AnalyticsPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [readings, setReadings] = useState<ReadingPoint[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<string>(ALL_METRICS);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Load devices ────────────────────────────────────────────────────────────
  useEffect(() => {
    devicesApi
      .findAll(1, 100)
      .then(({ data }) => {
        setDevices(data.data);
        if (data.data.length > 0) setSelectedDeviceId(data.data[0].id);
      })
      .catch(() => {})
      .finally(() => setIsLoadingDevices(false));
  }, []);

  // ── Load metrics + readings ─────────────────────────────────────────────────
  const loadData = useCallback(async (deviceId: string) => {
    if (!deviceId) return;
    setIsLoadingData(true);
    setMetrics([]);
    setReadings([]);
    setSelectedMetric(ALL_METRICS);
    try {
      const [metricsRes, readingsRes] = await Promise.all([
        analyticsApi.getMetrics(deviceId),
        analyticsApi.getReadings(deviceId, 1, 100),
      ]);

      setMetrics(metricsRes.data);

      const points: ReadingPoint[] = (readingsRes.data.data as DeviceReading[])
        .slice()
        .reverse()
        .map((r) => ({
          time: new Date(r.timestamp).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          fullTime: new Date(r.timestamp).toLocaleString('es-ES', {
            dateStyle: 'short',
            timeStyle: 'short',
          }),
          value: r.value,
          unit: r.unit,
          metricType: r.metricType,
        }));
      setReadings(points);
    } catch {
      // silent
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    void loadData(selectedDeviceId);
  }, [loadData, selectedDeviceId, refreshKey]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);
  const filteredReadings =
    selectedMetric === ALL_METRICS
      ? readings
      : readings.filter((r) => r.metricType === selectedMetric);

  const selectedMetricData = metrics.find((m) => m.field === selectedMetric);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-medium">Analytics</h3>
          <p className="text-sm text-muted-foreground">Métricas y lecturas por dispositivo.</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Device selector */}
          {!isLoadingDevices && (
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
            >
              {devices.length === 0 && <option value="">Sin dispositivos</option>}
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — {d.location}
                </option>
              ))}
            </select>
          )}

          {/* Refresh */}
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            disabled={isLoadingData || !selectedDeviceId}
            onClick={() => setRefreshKey((k) => k + 1)}
            title="Actualizar datos"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingData ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Metric filter tabs */}
      {metrics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedMetric(ALL_METRICS)}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
              selectedMetric === ALL_METRICS
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-accent'
            }`}
          >
            Todas las métricas
          </button>
          {metrics.map((m, idx) => (
            <button
              key={m.field}
              onClick={() => setSelectedMetric(m.field)}
              className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
                selectedMetric === m.field
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-accent'
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: LINE_COLORS[idx % LINE_COLORS.length] }}
              />
              {m.field}
              <span className="opacity-70">
                ({readings.filter((r) => r.metricType === m.field).length})
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoadingData && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <div className="h-32 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ALL METRICS view: sparkline cards grid */}
      {!isLoadingData && selectedMetric === ALL_METRICS && metrics.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((m, idx) => (
            <MetricSparkCard
              key={m.field}
              metric={m}
              readings={readings.filter((r) => r.metricType === m.field)}
              color={LINE_COLORS[idx % LINE_COLORS.length]}
              onClick={() => setSelectedMetric(m.field)}
            />
          ))}
        </div>
      )}

      {/* SINGLE METRIC view: stat cards + full chart */}
      {!isLoadingData && selectedMetric !== ALL_METRICS && selectedMetricData && (
        <>
          {/* Stats row */}
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              { label: 'Promedio', value: Number(selectedMetricData.avg).toFixed(2) },
              { label: 'Mínimo', value: Number(selectedMetricData.min).toFixed(2) },
              { label: 'Máximo', value: Number(selectedMetricData.max).toFixed(2) },
              { label: 'Último valor', value: Number(selectedMetricData.lastValue).toFixed(2) },
            ].map(({ label, value }) => (
              <Card key={label}>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground">
                    {label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {value}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">
                      {selectedMetricData.unit}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Full line chart */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                {selectedMetric}
                {selectedDevice ? ` — ${selectedDevice.name}` : ''}
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {filteredReadings.length} lecturas
              </span>
            </CardHeader>
            <CardContent>
              {filteredReadings.length === 0 ? (
                <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                  Sin lecturas para esta métrica.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart
                    data={filteredReadings}
                    margin={{ top: 4, right: 16, left: -8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 11 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      unit={` ${selectedMetricData.unit}`}
                      width={60}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 12 }}
                      formatter={(v) => [
                        `${v} ${selectedMetricData.unit}`,
                        selectedMetric,
                      ]}
                      labelFormatter={(label, payload) =>
                        (payload?.[0]?.payload as ReadingPoint | undefined)?.fullTime ?? label
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={
                        LINE_COLORS[
                          metrics.findIndex((m) => m.field === selectedMetric) %
                            LINE_COLORS.length
                        ]
                      }
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty states */}
      {!isLoadingData && !isLoadingDevices && devices.length === 0 && (
        <Card>
          <CardContent className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            No hay dispositivos registrados. Crea uno en la sección Dispositivos.
          </CardContent>
        </Card>
      )}
      {!isLoadingData && selectedDeviceId && metrics.length === 0 && (
        <Card>
          <CardContent className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            Este dispositivo aún no tiene lecturas. Espera a que envíe datos por MQTT.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
