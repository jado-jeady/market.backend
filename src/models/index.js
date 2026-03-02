import sequelize from '../config/database.js';
import User from './User.js';
import Category from './Category.js';
import Product from './Product.js';
import Sale from './Sales.js';
import StockAdjustment from './StockAdjustment.js';
import SaleItem from './SaleItem.js';
import Shift from './Shifts.js';
import Production from './Productions.js';
import ProductionItem from './ProductionItems.js';

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




StockAdjustment.belongsTo(Product, { foreignKey: "product_id" });
StockAdjustment.belongsTo(User, { foreignKey: "user_id" });
Product.hasMany(StockAdjustment, { foreignKey: 'product_id' });

// Product - SaleItem (One to Many)
Product.hasMany(SaleItem, {
  foreignKey: 'product_id',
  as: 'sale_items'
});
SaleItem.belongsTo(Product, {
  foreignKey: 'product_id',
  as: 'product'
});

Sale.hasMany(SaleItem, { foreignKey: 'sale_id' });
SaleItem.belongsTo(Sale, { foreignKey: 'sale_id' });

// Sale.belongsTo(Shift, { foreignKey: "shift_id" });
// Shift.hasMany(Sale, { foreignKey: "shift_id" });

// Shift.belongsTo(User, { foreignKey: "id" });
// User.hasMany(Shift, { foreignKey: "shift_id" });


// Production ↔ ProductionItem
Production.hasMany(ProductionItem, {
  foreignKey: 'production_id',
  as: 'items',
});

ProductionItem.belongsTo(Production, {
  foreignKey: 'production_id',
  as: 'production',
});

// Who submitted
Production.belongsTo(User, {
  foreignKey: 'submitted_by',
  as: 'submittedBy',
});

// Who approved
Production.belongsTo(User, {
  foreignKey: 'approved_by',
  as: 'approvedBy',
});

// Who rejected
Production.belongsTo(User, {
  foreignKey: 'rejected_by',
  as: 'rejectedBy',
});
// ProductionItem ↔ Product
ProductionItem.belongsTo(Product, {
  foreignKey: 'product_id',
  as: 'product',
});

Product.hasMany(ProductionItem, {
  foreignKey: 'product_id',
  as: 'production_items',
});

const db = {
  sequelize,
  User,
  Category,
  Product,
  Sale,
  SaleItem,
  StockAdjustment,
  Shift,
  Production,
  ProductionItem
};

export default db;