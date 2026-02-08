import app from './src/app.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

app.listen(PORT,HOST, () => {
  console.log(`Server running on port http://${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});