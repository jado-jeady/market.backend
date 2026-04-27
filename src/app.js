import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import db from "./models/index.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import productRoutes from "./routes/product.routes.js";
import saleRoutes from "./routes/sale.routes.js";
import { errorHandler } from "./middleware/error.middleware.js";
import stockRoutes from "./routes/stock.routes.js";
import ShiftRoutes from "./routes/shift.routes.js";
import storekeeperRoutes from "./routes/storekeeper.routes.js";
import expenseRoutes from "./routes/expense.routes.js";
import e from "express";

dotenv.config();

const app = express();

// --- FIXED CORS CONFIGURATION ---
const allowedOrigins = [
  "https://marketfrontend.vercel.app",
  "https://market-frontend-olive.vercel.app",
  "http://localhost:8080", // For local development
  "http://localhost:3000", // For Vite development
  "http://192.168.0.5:3000", // For Vite development
  "https://bitter-breeze-52de.rwandamasteryhub2024.workers.dev/",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg =
          "The CORS policy for this site does not allow access from the specified Origin.";
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
// --------------------------------

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
// Note: You have sync here AND in main.js. It's cleaner to keep it in one place.
db.sequelize
  .sync({ alter: true })
  .then(() => {
    console.log("✅ Database synchronized");
  })
  .catch((err) => {
    console.error("❌ Database synchronization error:", err);
  });

// Routes
app.get("/", (req, res) => {
  res.json({
    success: true,
    status: `active`,
    message: "Welcome to Supermarket Management System API",
    version: "1.0.0",
    documentation: `View the documentation here ${"http://localhost/api/documentation"} `,
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/storekeeper", storekeeperRoutes);
app.use("/api/shift", ShiftRoutes);
app.use("/api/expense", expenseRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    status: `inactive`,
    message: `Cannot ${req.method} ${req.url}`,
    waring: `conntact the admin via 0782228575 for more information or read this documentation http:localhost:3000/api/documentation`,
  });
});

// Error handler
app.use(errorHandler);

export default app;
