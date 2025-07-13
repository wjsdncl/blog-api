import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../utils/logger.js";

const execAsync = promisify(exec);

export async function runDataMigration(): Promise<void> {
  const shouldAutoMigrate = process.env.AUTO_MIGRATE_DATA === "true";
  const isProduction = process.env.NODE_ENV === "production";

  if (!shouldAutoMigrate) {
    logger.info("자동 데이터 마이그레이션이 비활성화되어 있습니다.");
    return;
  }

  logger.info("🚀 자동 데이터 마이그레이션 시작...");

  try {
    // 프로덕션용 마이그레이션 스크립트 실행
    const scriptPath = isProduction ? "node prisma/migrate-blog-data-production.js" : "node prisma/migrate-blog-data.js";

    const { stdout, stderr } = await execAsync(scriptPath);

    if (stdout) {
      logger.info("마이그레이션 출력:", { output: stdout });
    }

    if (stderr) {
      logger.warn("마이그레이션 경고:", { warnings: stderr });
    }

    logger.info("✅ 자동 데이터 마이그레이션 완료");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error("💥 자동 데이터 마이그레이션 실패:", {
      error: errorMessage,
      stack: errorStack,
    });

    // 프로덕션에서는 마이그레이션 실패 시 서버 시작을 중단하지 않음
    if (isProduction) {
      logger.warn("프로덕션 환경에서 마이그레이션 실패를 무시하고 서버를 시작합니다.");
    } else {
      throw error;
    }
  }
}
