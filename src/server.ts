import { Request, Response, Express } from 'express';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { pinoHttp } from 'pino-http';
import { router } from './routes/auth.routes';

dotenv.config();

const app: Express = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',') : true,
    credentials: true,
  })
);

app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use(pinoHttp());

app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({ data: 'server is life' });
});

app.use('/auth', router);

const port = Number(process.env.PORT) || 5000;

app.listen(port, () => {
  console.log(`Server at ${port}`);
});
