import config from './config'
import * as winston from 'winston';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const enumerateErrorFormat = winston.format((info: any) => {
  if (info instanceof Error) {
    Object.assign(info, { message: info.stack });
  }
  return info;
});

const logger = winston.createLogger({
  level: config.env === 'development' || config.env === 'staging' ? 'debug' : 'info',
  format: winston.format.combine(
    enumerateErrorFormat(),
    config.env === 'development' ? winston.format.colorize() : winston.format.uncolorize(),
    winston.format.splat(),
    winston.format.printf(({ level, message }) => `${level}: ${message}`)
  ),
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error'],
    }),
  ],
});

export default logger;
