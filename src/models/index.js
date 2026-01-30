import sequelize from '../config/database.js';
import User from './User.js';
import Category from './Category.js';
import Product from './Product.js';
import Sale from './Sale.js';
import SaleItem from './SaleItem.js';

// Define relationships

// Category - Product (One to Many)
Category.hasMany(Product, {
  foreignKey: 'category_id',
  as: 'products'
});
Product.belongsTo(Category, {
  foreignKey: 'category_id',
  as: 'category'
});

// User - Sale (One to Many)
User.hasMany(Sale, {
  foreignKey: 'user_id',
  as: 'sales'
});
Sale.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
});

// Sale - SaleItem (One to Many)
Sale.hasMany(SaleItem, {
  foreignKey: 'sale_id',
  as: 'items'
});
SaleItem.belongsTo(Sale, {
  foreignKey: 'sale_id',
  as: 'sale'
});

// Product - SaleItem (One to Many)
Product.hasMany(SaleItem, {
  foreignKey: 'product_id',
  as: 'sale_items'
});
SaleItem.belongsTo(Product, {
  foreignKey: 'product_id',
  as: 'product'
});

const db = {
  sequelize,
  User,
  Category,
  Product,
  Sale,
  SaleItem
};

export default db;