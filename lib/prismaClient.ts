/**
 * Prisma 싱글톤 클라이언트
 *
 * Prisma 7부터 pg Pool + PrismaPg 어댑터가 필수.
 * 개발 환경에서는 모든 쿼리 로그 출력.
 */
import { PrismaClient } from "./generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

class PrismaClientSingleton {
  private static instance: PrismaClient;

  static getInstance(): PrismaClient {
    if (!PrismaClientSingleton.instance) {
      const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
      const adapter = new PrismaPg(pool);

      PrismaClientSingleton.instance = new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === "development" ? ["query", "error", "info", "warn"] : ["error"],
      });
    }

    return PrismaClientSingleton.instance;
  }
}

export const prisma = PrismaClientSingleton.getInstance();
