import { PrismaClient } from "./generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

class PrismaClientSingleton {
  private static instance: PrismaClient;

  static getInstance(): PrismaClient {
    if (!PrismaClientSingleton.instance) {
      // Create PostgreSQL connection pool for Prisma 7 adapter
      const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
      });

      // Create Prisma adapter (required in Prisma 7)
      const adapter = new PrismaPg(pool);

      // Initialize Prisma Client with adapter
      PrismaClientSingleton.instance = new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === "development" ? ["query", "error", "info", "warn"] : ["error"],
      });
    }

    return PrismaClientSingleton.instance;
  }
}

export const prisma = PrismaClientSingleton.getInstance();
