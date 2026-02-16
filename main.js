import app from './src/app.js';
import sequelize from './src/config/database.js'; // Adjust path as needed
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

// 1. Start listening FIRST so Render sees the port is open
app.listen(PORT, HOST, () => {
  console.log(`🚀 Server listening on http://${HOST}:${PORT}`);
  
  // 2. Then try to connect to the database
  sequelize.authenticate()
    .then(() => {
      console.log('✅ Database connected successfully.');
      return sequelize.sync();
    })
    .catch(err => {
      console.error('❌ Database connection failed:', err.message);
      // Don't process.exit(1) here yet, let the server stay "alive" for Render
    });
});
