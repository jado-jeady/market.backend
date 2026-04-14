import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

// Use the full DATABASE_URL if it exists, otherwise fall back to separate vars (for local dev)
const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: "postgres",
      dialectOptions: {
        family: 6, // Crucial for Andasy IPv6
      },
      logging: process.env.NODE_ENV === "development" ? console.log : false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
    })
  : new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: "postgres",
        dialectOptions: {
          family: 6,
        },
        logging: console.log,
      },
    );

export default sequelize;
