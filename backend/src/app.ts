import express from 'express';
import userRouter from './routes/user';
import workerRouter from './routes/worker';
import httpStatus from 'http-status';
import ApiError from './utils/ApiError';
import { errorConverter, errorHandler } from './middleware/error';
import cors from 'cors';
import morgan from './config/Morgan'
import config from './config/config';

const app = express();

if (config.env !== 'test') {
    app.use(morgan.successHandler);
    app.use(morgan.errorHandler);
}

app.use(express.json())
// parse urlencoded request body
app.use(express.urlencoded({ extended: true }));

// enable cors
app.use(cors({ origin: true }));
app.options('*', cors());

app.use("/v1/user", userRouter),
app.use("/v1/worker", workerRouter)

// send back a 404 error for any unknown api request
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use((_: any, __: any, next: (arg0: any) => void) => {
    next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// convert error to ApiError, if needed
app.use(errorConverter);

// handle error
app.use(errorHandler);


export default app;