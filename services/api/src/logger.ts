import { AppConfig, LogLevel } from './types.js';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface LogFields {
  requestId?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  error?: unknown;
  [key: string]: unknown;
}

export class Logger {
  constructor(private readonly config: AppConfig) {}

  debug(message: string, fields: LogFields = {}): void {
    this.log('debug', message, fields);
  }

  info(message: string, fields: LogFields = {}): void {
    this.log('info', message, fields);
  }

  warn(message: string, fields: LogFields = {}): void {
    this.log('warn', message, fields);
  }

  error(message: string, fields: LogFields = {}): void {
    this.log('error', message, fields);
  }

  private log(level: LogLevel, message: string, fields: LogFields): void {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.config.logLevel]) {
      return;
    }

    const payload = {
      timestamp: new Date().toISOString(),
      level,
      service: this.config.apiName,
      message,
      ...fields,
    };

    const output = JSON.stringify(payload);
    if (level === 'error') {
      console.error(output);
      return;
    }

    console.log(output);
  }
}
