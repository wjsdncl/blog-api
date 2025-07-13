import winston from "winston";
import path from "path";

const logFormat = winston.format.combine(winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), winston.format.errors({ stack: true }), winston.format.json());

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  defaultMeta: { service: "blog-api" },
  transports: [
    // 에러 로그는 별도 파일에 저장
    new winston.transports.File({
      filename: path.join("logs", "error.log"),
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // 모든 로그는 combined.log에 저장
    new winston.transports.File({
      filename: path.join("logs", "combined.log"),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// 개발 환경에서는 콘솔에도 출력
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    })
  );
}

export { logger };
