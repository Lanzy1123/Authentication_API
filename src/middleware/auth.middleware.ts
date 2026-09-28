import {ZodSchema} from 'zod';
import { Request,Response,NextFunction } from 'express';
import jwt,{SignOptions,JwtPayload} from 'jsonwebtoken';
import { prisma } from '../db';

export const validate =(schema: ZodSchema)=>(req: Request,res: Response,next: NextFunction)=>{
  const result = schema.safeParse(req.body)
  if (!result.success){
    return res.status(400).json({error:result.error.issues})
  }
  req.body = result.data;
  next();
}

type Payload = {
  id: number,
  email: string,

}
const ACCESS_SECRET = process.env.ACCESS_SECRET
const REFRESH_SECRET = process.env.REFRESH_SECRET


export const accessToken=(user :Payload): string=>{
  const options: SignOptions = {
    'expiresIn':'5m'
  }
  return jwt.sign(
    user,
    ACCESS_SECRET!,
    options
  )
}

export const refreshToken=(user: Payload): string=>{
  const options: SignOptions = {
    'expiresIn':'7d'
  }
  return jwt.sign(
    user,
    REFRESH_SECRET!,
    options
  )
}


export interface AuthRequest extends Request {
  user?:{id: number,email: string}
}

export const Authenticate=async(
    req: AuthRequest,
    res: Response,
    next:NextFunction )=>{

  try {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) return res.status(401).json({message:"Forbidden: No Token"})

  const decoded =jwt.verify(token,ACCESS_SECRET!) as JwtPayload 

  req.user={
    id:decoded.id,
    email:decoded.email
  }
  next()
  } catch(err: any){
    if (err instanceof jwt.TokenExpiredError){
      return res.status(401).json(
        {
          message:"Unauthorized: Token Expired"
        }
      )
    }

    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json(
        {
        message:"Forbidden: InvalidToken"
      }
      ) 
    }
    return res.status(500).json(
      {
        message:"internal server issue"
      }
    )
  }

}

export const validateRefreshToken = async(req: AuthRequest,res: Response,next: NextFunction)=>{
  try {
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
  if (!refreshToken) return res.status(401).json({
    message:"Refresh Token is missing"
  })

  const payload = jwt.verify(refreshToken,REFRESH_SECRET!) as {id: number}
  const user = await prisma.user.findUnique({
    where: {
      id: payload.id
    }
  })

  if (!user) return res.status(404).json({message:"user not found"})

  req.user={
    id:user.id,
    email:user.email
  }

  next();
  } catch(err: any) {
    res.status(500).json({
      message:"internal server issue"
    })
    console.log("Refresh error: ",err)
  }

}
