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
  console.log(`Server listening on http://${HOST}:${PORT}`);

  try {
    // Connect DB (Instant connection verification over the pool)
    await sequelize.authenticate();
    console.log("Database connected successfully cleanly via connection pool.");

    // NOTE: await sequelize.sync() and raw ENUM blocks are removed.
    // Structural management is handled entirely via your .cjs migration pipeline!
  } catch (error) {
    console.error("Database connection failed:", error);
  }
});

// 4. Graceful shutdown handler
const gracefulShutdown = () => {
  console.log(" SIGTERM/SIGINT received: starting graceful shutdown...");

  // 1. Stop taking on new incoming server network streams
  httpServer.close(async () => {
    console.log("HTTP server closed.");

    try {
      // 2. Cleanly disconnect the active connection pool, shedding RAM burden instantly
      await sequelize.close();
      console.log("Database connection pool closed cleanly.");
      process.exit(0);
    } catch (err) {
      console.error("Error closing database during shutdown:", err);
      process.exit(1);
    }
  });
};

// Intercept Render's service destruction signal (SIGTERM)
process.on("SIGTERM", gracefulShutdown);

// Intercept Ctrl+C terminal interruption during local dev testing (SIGINT)
process.on("SIGINT", gracefulShutdown);
