import {Response,Express} from 'express';
import express from 'express';
import { pinoHttp } from 'pino-http';
import { router } from './routes/auth.routes';
// import { cookieParser } from 'cookie-parser'
const app :Express = express();
app.use(express.json());
app.use(pinoHttp());
// app.use(cookieParser())

app.get("/",(res: Response)=>{
  res.status(200).json({data:"server is life"})
});

app.use("/auth",router);
const port = process.env.PORT;
app.listen(port,()=>{
  console.log(`Server at ${port}`);
  
});

