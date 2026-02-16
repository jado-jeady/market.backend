import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// Use the URL string directly if it exists, otherwise fall back to parts
const sequelize = process.env.DATABASE_URL 
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false // Required for most cloud DBs
        }
      }
    })
  : new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      { host: process.env.DB_HOST, dialect: 'postgres' }
    );

export default sequelize;
