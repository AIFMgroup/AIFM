import winston from 'winston';
import path from 'path';

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// Log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Colors for console output
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(
    (info) =>
      `${info.timestamp} ${info.level}: ${info.message}${
        info.stack ? '\n' + info.stack : ''
      }`
  )
);

// Transports - where logs are written
const transports: winston.transport[] = [
  // Console output (all environments during development)
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize({ all: true }),
      format
    ),
  }),
];

// Add file transports in production/staging
if (!isDevelopment && !isTest) {
  // Create logs directory if it doesn't exist
  const logsDir = path.join(process.cwd(), 'logs');

  transports.push(
    // Error logs
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: format,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // All logs
    new winston.transports.File({
      filename: path.join(logsDir, 'all.log'),
      format: format,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Create the logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  levels,
  format,
  transports,
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'exceptions.log'),
      format: format,
    }),
  ],
});

// Graceful shutdown
if (process.on) {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled Rejection:', reason);
    process.exit(1);
  });
}

// Export helper functions
export const logInfo = (message: string, meta?: Record<string, unknown>) => {
  logger.info(message, { ...meta });
};

export const logError = (message: string, error?: Error, meta?: Record<string, unknown>) => {
  logger.error(message, {
    ...(error && { stack: error.stack, errorMessage: error.message }),
    ...meta,
  });
};

export const logWarn = (message: string, meta?: Record<string, unknown>) => {
  logger.warn(message, { ...meta });
};

export const logDebug = (message: string, meta?: Record<string, unknown>) => {
  logger.debug(message, { ...meta });
};

export const logHttp = (message: string, meta?: Record<string, unknown>) => {
  logger.log('http', message, { ...meta });
};

export default logger;
