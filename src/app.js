import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db from './models/index.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import categoryRoutes from './routes/category.routes.js';
import productRoutes from './routes/product.routes.js';
import saleRoutes from './routes/sale.routes.js';
import { errorHandler } from './middleware/error.middleware.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
db.sequelize.sync({ force: false })
  .then(() => {
    console.log('Database synchronized');
  })
  .catch(err => {
    console.error('Database synchronization error:', err);
  });

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Supermarket Management System API',
    version: '1.0.0',
    documentation: '/api-docs' // You can add Swagger later
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.url}`
  });
});

// Error handler
app.use(errorHandler);

export default app;