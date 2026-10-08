export type TemperatureUnit = 'C' | 'F';
export const toCelsius = (value: number, unit: TemperatureUnit) =>
  unit === 'F' ? ((value - 32) * 5) / 9 : value;
export const fromCelsius = (value: number, unit: TemperatureUnit) =>
  unit === 'F' ? (value * 9) / 5 + 32 : value;
export function validTemperature(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -273.15 && value <= 500;
}
