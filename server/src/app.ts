import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env } from './config/env';
import { errorHandler } from './middleware/error-handler';
import { authRouter } from './modules/auth/auth.routes';
import { userRouter } from './modules/users/user.routes';

export const app = express();

app.set('trust proxy', env.TRUST_PROXY);

app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: false
  })
);
app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api', userRouter);

app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

app.use(errorHandler);
