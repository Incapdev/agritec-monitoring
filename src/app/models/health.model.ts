export interface ServiceConfig {
  id: string;
  name: string;
  type: 'api' | 'ui';
  healthUrl: string;
  logsUrl?: string;
  appUrl?: string;
  healthPageUrl?: string;
  swaggerUrl?: string;
}

export interface EnvironmentConfig {
  label: string;
  services: ServiceConfig[];
}

export interface ServiceStatus {
  id: string;
  name: string;
  type: 'api' | 'ui';
  status: 'up' | 'down' | 'loading';
  responseTime?: number;
  url: string;
  error?: string;
  detail?: any;
  databases?: DatabaseStatus[];
  appUrl?: string;
  healthPageUrl?: string;
  swaggerUrl?: string;
}

export interface DatabaseStatus {
  name: string;
  status: 'up' | 'down';
  server?: string;
  database?: string;
  version?: string;
  error?: string;
}

export interface LogFile {
  name: string;
  size: string;
  lastModified: string;
}
