import { PrismaClient } from "@prisma/client";

class PrismaClientSingleton {
  private static instance: PrismaClient;

  static getInstance(): PrismaClient {
    if (!PrismaClientSingleton.instance) {
      PrismaClientSingleton.instance = new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["query", "error", "info", "warn"] : ["error"],
      });

      // 쿼리 성능 모니터링을 위한 미들웨어 설정
      PrismaClientSingleton.instance.$use(async (params, next) => {
        const before = Date.now();
        const result = await next(params);
        const after = Date.now();

        if (process.env.NODE_ENV === "development") {
          console.log(`Query ${params.model}.${params.action} took ${after - before}ms`);
        }

        return result;
      });
    }

    return PrismaClientSingleton.instance;
  }
}

export const prisma = PrismaClientSingleton.getInstance();
