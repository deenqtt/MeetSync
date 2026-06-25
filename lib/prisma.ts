import { PrismaClient } from "@prisma/client";

// Global Prisma client instance - singleton pattern to prevent connection leaks
declare global {
  var __prisma: PrismaClient | undefined;
}

// Create Prisma client with basic configuration
const createPrismaClient = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
};

// Use existing instance or create new one
export const prisma: PrismaClient =
  (globalThis as any).__prisma || createPrismaClient();

// Store in global for development hot reload
if (process.env.NODE_ENV !== "production") {
  (globalThis as any).__prisma = prisma;
}

// Connection health check function
export async function checkDatabaseConnection(): Promise<{
  connected: boolean;
  latency?: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    // Simple query to test connection
    await prisma.$queryRaw`SELECT 1`;

    const latency = Date.now() - startTime;

    return {
      connected: true,
      latency,
    };
  } catch (error: any) {
    const latency = Date.now() - startTime;

    return {
      connected: false,
      latency,
      error: error.message || "Database connection failed",
    };
  }
}

// Graceful shutdown function (use with caution in serverless environments)
export async function disconnectPrisma() {
  try {
    console.log("[PRISMA] Disconnecting from database...");
    await prisma.$disconnect();
    console.log("[PRISMA] Successfully disconnected from database");
  } catch (error) {
    console.error("[PRISMA] Error during disconnection:", error);
  }
}

// Export default for compatibility
export default prisma;
