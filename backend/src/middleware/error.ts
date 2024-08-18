import { NextFunction, Request, Response } from "express";
import config from '../config/config';
import * as httpStatus from 'http-status'
import logger from '../config/Logger';
import ApiError from '../utils/ApiError';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const errorConverter = (err: any, req: Request, res: Response, next: NextFunction): void => {
  const allowedOrigins = ['*'];
  const origin = req.headers.origin as string;
   if (allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
   }
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  let error = err;
  if (!(error instanceof ApiError)) {
    const statusCode =
      error.statusCode ? httpStatus.BAD_REQUEST : httpStatus.INTERNAL_SERVER_ERROR;
    const message = error.message || httpStatus[statusCode];
    error = new ApiError(statusCode, message, false, err.stack);
  }
  next(error);
};

// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
export const errorHandler = (err: any, __: Request, res: Response, _: NextFunction): void => {
  let { statusCode, message } = err;
  if (config.env === 'production' && !err.isOperational) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = httpStatus[httpStatus.INTERNAL_SERVER_ERROR];
  }

  res.locals.errorMessage = err.message;

  const response = {
    code: statusCode,
    message,
    ...((config.env === 'development' || config.env === 'staging') && { stack: err.stack }),
  };

  if (config.env === 'development' || config.env === 'staging') {
    console.log("H0")
    logger.error(err);
  }

  console.log("Ho")

  res.status(statusCode).send(response);
};