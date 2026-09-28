import argon2 from 'argon2'
import {z} from 'zod';
import { prisma } from '../db';
import {Request,Response} from 'express';
import { accessToken, AuthRequest, refreshToken } from '../middleware/auth.middleware';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const RegSchema = z.object({
  name: z.string().min(5,"name must be 5+ characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8,"password must contain 8+ characters")
})

const LoginSchema = z.object({
  email: z.string().email("enter email address!!"),
  password:z.string().min(8,"enter ur password!!")
})

const ResetSchema = z.object({
  resettoken: z.string(),
  password: z.string().min(8,"enter password!! 8+ characters")
})

const ForgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address!")
})

const PasswordSchema = z.object({
  password: z.string().min(8,"pass2ord must contain 8+ characters")
})

const NameSchema = z.object({
  name: z.string().min(5,"name must contain 5+ characters!!")
})

type AuthBody = z.infer<typeof RegSchema>;
type Log = z.infer<typeof LoginSchema>;

export const Register = async(req: Request,res: Response)=>{
  try {
    const result = RegSchema.safeParse(req.body);

    if (!result.success){
      return res.status(300).json(
        {
        message:"validation failed",
        data:result.error.flatten
        }
      );
    }

  const 
  {
    name,
    email,
    password
  }: AuthBody=result.data;

  const match = await prisma.user.findUnique({
    where : {
      email:email
    }
  })
   
  if (match) { 
    return res.status(409).json(
      {
        message:"user already exist"
      }
    ) 
  }

  const hashedPassword =await argon2.hash(password,{
    type:argon2.argon2id,
    memoryCost:2**16,
    timeCost:3,
    parallelism:1
  })

  const user = await prisma.user.create({
    data:{name: name,email: email,password: hashedPassword}
  })

  res.status(201).json({
  message:"user created successfully",
  data:{
    email:user.email,
    id:user.id,
    name:user.name
  }
})
  } catch(err: any) {
    res.status(500).json({message:"internal server issue",data:err.message})
  }
}

export const Login = async(
  req: Request,
  res: Response)=> {

  try {
  const result = LoginSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(300).json({
      message:"validation failed",
      error:result.error.flatten
    });
  }

  const {email,password}: Log = result.data;
  const user = await prisma.user.findUnique({
    where:{
      email: email
    }
  })

  if (!user) return res.status(404).json({
    message:"user not found!!!"
  });

  const isMatch=await argon2.verify(
    user.password,
    password
  );

  if (!isMatch) return res.status(403).json({
    message:"invalid password!!!"
  });
  const AccessToken = accessToken({id:user.id,email:user.email});
  const RefreshToken = refreshToken({id:user.id,email:user.email});

  const decoded = jwt.decode(RefreshToken) as { exp:number }
  const expiresAt = new Date(decoded.exp * 1000);

  await prisma.user.update({
    where:{
      id:user.id,
    },
    data:{
      refreshToken:RefreshToken,
      refreshExpired: expiresAt
    }
  })

  res.cookie("refreshtoken",RefreshToken,{
    sameSite:'lax',
    httpOnly:true,
    secure:false,
    maxAge:7 * 24 * 60 * 60 * 1000
  })

  res.status(200).json({
    message:"loggedin successfully",
    data:{id:user.id,email:user.email,name:user.name},
    accessToken: AccessToken,
    refreshToken: RefreshToken
  });

  } catch(err: any) {
    res.status(500).json({
      message:"Internal Server issue",
      error:err.message
    });
  }

}


export const Profile = async(req:AuthRequest,res: Response)=>{
  try {
    const {id,email}= req.user!;
    const user = await prisma.user.findUnique({
      where:{
        id:id,
        email:email
      }
    })

    if (!user) return res.status(401).json({
      message:"Authentucation required"
    })

  res.status(200).json({
    message:"user authenticated",user:{
      name:user.name,
      email:user.email,
      createdAt:user.createdAt,
      loggedInAt:new Date()
    }
  })
  } catch(err: any){
    res.status(500).json({message:"could not get profile!!"})
  }
}


export const refresh = async(req: AuthRequest,res: Response)=>{
  try {
    const {id,email}=req.user!;
    const newRefreshToken=refreshToken({id:id,email:email})
    const newAccessToken=accessToken({id:id,email:email})
    await prisma.user.update({
      where: { id:id },
      data: {
        refreshToken: newRefreshToken,
        refreshExpired: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    })

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge:7 * 24 * 60 * 60 * 1000
    })

    return res.status(200).json({ accessToken: newAccessToken })

  } catch(err: any){
    return res.status(403).json({ message: "Invalid token", error: err.message })
  }
}


export const LogOut = async(req: AuthRequest,res: Response)=> {

  try {
  const {id}=req.user!;
  const user = await prisma.user.findUnique({
    where:{
      id:id
    }
  })
  if (!user) return res.status(401).json({message:"Authentication required!!"})
  
  await prisma.user.update({
    where:{id:id},
    data:{
      refreshToken:null,
      refreshExpired:null
    }
  })

  res.clearCookie("refreshToken",{
    httpOnly:true,
    secure:true,
    sameSite:"lax",
  })

  res.status(200).json({
    message:"Logged Out SuccessFully",
    accessToken:null
  })
  } catch(err: any) {
    res.status(500).json({message:"Something went wrong"})
    console.log("Logout error: ",err)
  }
}

export const ForgotPassword = async(req: Request,res: Response)=>{
  try {
    const result = ForgotPasswordSchema.safeParse(req.body);
    if (!result.success) return res.status(300).json({message:"enter your email address!!"});
    const { email } = result.data;
  const user =await prisma.user.findUnique({
    where:{ email: email}
  })
  if (!user) res.status(200).json({message:"Reset Link Sent Successfully"})
  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  await prisma.user.update({
    where:{email: email},
    data: {
      resetToken: hashedToken,
      resetExpired: new Date(Date.now()+10*60*1000) //10min
    }
  })

  //nodemailer will handle email validation
  console.log(hashedToken)
  } catch(err: any){
    res.status(500).json({message:"internal server issue",error:err.message})
  }

}

export const ResetPassword = async(res: Response,req: Request) =>{

  try {
    const result = ResetSchema.safeParse(req.body);

    if (!result.success) return res.status(300).json({message:"password must contain 8+ characters"});

    const {resettoken,password}=result.data;

    const user = await prisma.user.findFirst({
      where: { 
        resetToken: resettoken,
        resetExpired: {
          gt:new Date()
        }
      }
    })

    if (!user) return res.status(400).json({message:"token expired!!!"});
    const hashedPassword =await argon2.hash(password,{
      type:argon2.argon2id,            
      memoryCost:2**16,            
      timeCost:3,            
      parallelism:1
    });

    await prisma.user.update({
      where: {
        email: user.email
      },
      data:{
        password: hashedPassword
      }
    })

  } catch(err: any){
    res.status(500).json({message:"internal server issue",error:err.message})
  }
}

export const Dashboard = async(res: Response,req: Request)=>{
  try {

  } catch(err: any) {
    res.status(500).json({message:"internal server issue"})
  }
}

export const UpdateProfile = async(req: AuthRequest, res: Response)=> {
  try {
    const result = NameSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({message:"invalid name provided"})
    const { name } = result.data;
    const { id } = req.user!;
    await prisma.user.update({ where: { id }, data: {name} })
    return res.status(200).json({message:"Name updated successfully"})
  } catch(err: any){
    return res.status(500).json({message:"internal server issue"})
  }
}

export const UpdateEmail = async(req: AuthRequest, res: Response)=>{
  try {
    const result = ForgotPasswordSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({message:"invalid email provided"})
    const { email } = result.data;
    const { id } = req.user!;
    await prisma.user.update({ where: { id }, data: { email } })
    return res.status(200).json({message:"Email updated successfully"})
  } catch(err: any) {
    return res.status(500).json({message:"internal server issue"})
  }
}

export const UpdatePassword = async(req: AuthRequest, res: Response)=> {
  try {
    const result = PasswordSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ message:"invalid length of password" })
    const { password } = result.data;
    const { id } = req.user!;
    const hashed = await argon2.hash(password,{
      type: argon2.argon2id,
      timeCost: 3,
      parallelism: 1,
      memoryCost: 2**16
    })
    await prisma.user.update({ where: { id }, data: {password: hashed} })
    return res.status(200).json({message:"password updated successfully"})
  } catch(err: any){
    return res.status(500).json({message: "internal server issue"})
  }
}
