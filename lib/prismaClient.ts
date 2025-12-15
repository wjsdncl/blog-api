import { PrismaClient } from "@prisma/client";
import { config } from "../config/index.js";

class PrismaClientSingleton {
  private static instance: PrismaClient;

  static getInstance(): PrismaClient {
    if (!PrismaClientSingleton.instance) {
      PrismaClientSingleton.instance = new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["query", "error", "info", "warn"] : ["error"],
      });
    }

    return PrismaClientSingleton.instance;
  }
}

export const prisma = PrismaClientSingleton.getInstance();
