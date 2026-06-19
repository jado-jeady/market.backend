import app from "./src/app.js";
import sequelize from "./src/config/database.js";
import dotenv from "dotenv";
import { createServer } from "http";
import { initSocket } from "./src/utils/socket.js"; // utility we wrote earlier

dotenv.config();

let PORT = process.env.PORT || 8888;
let HOST = process.env.HOST || "0.0.0.0";

if (process.env.NODE_ENV === "development") {
  PORT = 8888;
  HOST = "0.0.0.0";
}

console.log(
  `Loading environment: ${process.env.NODE_ENV} on ${HOST}:${PORT} ...`,
);

// 1. Wrap Express in HTTP server
const httpServer = createServer(app);

// 2. Initialize Socket.IO
const io = initSocket(httpServer);

// 3. Start server
httpServer.listen(PORT, HOST, async () => {
  console.log(`🚀 Server listening on http://${HOST}:${PORT}`);

  try {
    // Connect DB
    await sequelize.authenticate();
    console.log("✅ Database connected successfully.");

    // Apply ENUM migration
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'Baristary'
          AND enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'enum_products_product_type'
          )
        ) THEN
          ALTER TYPE "enum_products_product_type" ADD VALUE 'Baristary';
        END IF;
      END
      $$;
    `);
    console.log("✅ ENUM migration applied.");

    // Sync models
    await sequelize.sync({ alter: true });
    console.log("✅ Database synchronized.");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
  }
});

// 4. Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received: closing HTTP server");
  httpServer.close(() => {
    console.log("HTTP server closed");
  });
});
