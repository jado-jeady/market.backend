import app from './src/app.js';
import sequelize from './src/config/database.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 8080;
// Using '0.0.0.0' is generally more compatible for cloud deployments like Render/Heroku
const HOST = process.env.HOST || '0.0.0.0';

/**
 * 1. Start the server first
 * This ensures the hosting platform (Render/Vercel) detects the open port 
 * immediately, preventing "Port scan timeout" errors.
 */
const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Server listening on http://${HOST}:${PORT}`);
  
  /**
   * 2. Connect to the database after the port is open
   */
  sequelize.authenticate()
    .then(() => {
      console.log('✅ Database connected successfully.');
    })
    .then(() => {
      console.log('📦 Database models synced.');
    })
    .catch(err => {
      console.error('❌ Database connection failed:', err.message);
      // We keep the server alive so you can check logs, 
      // but the API will likely return 500 errors for DB routes.
    });
});

// Handle graceful shutdowns
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
