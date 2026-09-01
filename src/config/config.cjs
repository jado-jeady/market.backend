// Load environment variables for local dev execution
require("dotenv").config();

module.exports = {
  development: {
    username: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || null,
    database: process.env.DB_NAME || "tyga_market",
    host: process.env.DB_HOST || "127.0.0.1",
    port: process.env.DB_PORT || 5432,
    dialect: "postgres",
    logging: false,
  },
  production: {
    // Render provides DATABASE_URL automatically. The CLI can read it directly using 'use_env_variable'
    use_env_variable: "DATABASE_URL",
    dialect: "postgres",
    logging: false,
    dialectOptions: {
      family: 6, // Crucial for Render IPv6 infrastructure
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  },
};
