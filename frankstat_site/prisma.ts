import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient({
  adapter: {
    url: process.env.DATABASE_URL,
  },
});

export default prisma;