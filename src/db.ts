//import { PrismaClient } from '@prisma/client'
import "dotenv/config"
import { PrismaClient } from "./generated/prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"
const adapter = new PrismaMariaDb({
  host:process.env.DB_HOST!,
  port:Number(process.env.DB_PORT ?? 3306),
  user:process.env.DB_USER!,
  password:process.env.DB_PASS!,
  database:process.env.DB_NAME!
})
export const prisma = new PrismaClient({ adapter })
