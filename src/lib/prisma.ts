// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Next.jsの再読み込みで重複してDB接続が作られないようグローバル領域に保持します
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// ① PostgreSQL への接続プール（通信の口）を作成します
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ② Prisma 7 で必須となった PostgreSQL 用のアダプターを作成します
const adapter = new PrismaPg(pool);

// ③ PrismaClient のコンストラクタに adapter を渡して初期化します
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;