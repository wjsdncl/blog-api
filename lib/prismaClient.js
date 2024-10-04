import { PrismaClient } from "@prisma/client";

class PrismaClientSingleton {
  static instance;

  static getInstance() {
    if (!PrismaClientSingleton.instance) {
      PrismaClientSingleton.instance = new PrismaClient({
        log: [
          { emit: "event", level: "query" },
          { emit: "stdout", level: "error" },
          { emit: "stdout", level: "info" },
          { emit: "stdout", level: "warn" },
        ],
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

// 개발 환경에서 쿼리 로깅
if (process.env.NODE_ENV === "development") {
  prisma.$on("query", (e) => {
    console.log("Query: " + e.query);
    console.log("Duration: " + e.duration + "ms");
  });
}
