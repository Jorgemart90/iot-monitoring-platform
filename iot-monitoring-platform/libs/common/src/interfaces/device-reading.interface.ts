export interface IDeviceReading {
  deviceId: string;
  temperature?: number;
  humidity?: number;
  pressure?: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}
