export const KAFKA_TOPICS = {
  DEVICE_READINGS: 'device.readings',
  DEVICE_CREATED: 'device.created',
  DEVICE_UPDATED: 'device.updated',
  ALERT_TRIGGERED: 'alert.triggered',
  NOTIFICATION_SENT: 'notification.sent',
};

export const MQTT_TOPICS = {
  DEVICE_DATA: 'iot/devices/+/data',
  DEVICE_STATUS: 'iot/devices/+/status',
};

export const REDIS_KEYS = {
  DEVICE_CACHE: 'device:',
  METRICS_CACHE: 'metrics:',
  ALERT_RULES: 'alert:rules:',
};
