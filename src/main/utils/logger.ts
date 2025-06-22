import winston from 'winston';
import { join } from 'path';
import { app } from 'electron';

// Create logs directory path
const getLogsPath = () => {
  try {
    return join(app.getPath('logs'), 'nexus-mvp');
  } catch {
    // Fallback if app is not ready
    return join(process.cwd(), 'logs');
  }
};

// Create logger configuration
const createLogger = () => {
  const logsPath = getLogsPath();
  
  return winston.createLogger({
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    transports: [
      // Console transport for development
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }),
      
      // File transport for all logs
      new winston.transports.File({
        filename: join(logsPath, 'nexus-mvp.log'),
        maxsize: 5242880, // 5MB
        maxFiles: 5
      }),
      
      // Error-only file transport
      new winston.transports.File({
        filename: join(logsPath, 'error.log'),
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      })
    ],
    
    // Handle uncaught exceptions
    exceptionHandlers: [
      new winston.transports.File({
        filename: join(logsPath, 'exceptions.log')
      })
    ],
    
    // Handle unhandled promise rejections
    rejectionHandlers: [
      new winston.transports.File({
        filename: join(logsPath, 'rejections.log')
      })
    ]
  });
};

// Export logger instance
export const logger = createLogger();

// Export logger levels for external use
export const logLevels = {
  error: 'error',
  warn: 'warn',
  info: 'info',
  debug: 'debug'
} as const; 