import winston from 'winston';
import { join } from 'path';
import { app } from 'electron';
import { APP_CONSTANTS } from '../../shared/constants.js';

// Create logs directory path
const getLogsPath = () => {
  try {
    return join(app.getPath('logs'), APP_CONSTANTS.APP_NAME);
  } catch {
    // Fallback if app is not ready
    return join(process.cwd(), APP_CONSTANTS.LOGS_DIR_NAME);
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
        filename: join(logsPath, APP_CONSTANTS.LOG_FILE_NAME),
        maxsize: 5242880, // 5MB
        maxFiles: 5
      }),
      
      // Error-only file transport
      new winston.transports.File({
        filename: join(logsPath, APP_CONSTANTS.ERROR_LOG_FILE_NAME),
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