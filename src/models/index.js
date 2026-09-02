import sequelize from "../config/database.js";
import User from "./User.js";
import Category from "./Category.js";
import Product from "./Product.js";
import Sale from "./Sales.js";
import StockAdjustment from "./StockAdjustment.js";
import SaleItem from "./SaleItem.js";
import Shift from "./Shifts.js";
import Production from "./Productions.js";
import ProductionItem from "./ProductionItems.js";
import Return from "./Returns.js";
import Expense from "./Expenses.js";
import ExpenseCategory from "./ExpenseCategory.js";
import Damage from "./Damage.js";
import Notification from "./Notification.js";
import PriceChange from "./PriceChange.js";
import Report from "./Reports.js";

// Define relationships

// Category - Product (One to Many)
Category.hasMany(Product, {
  foreignKey: "category_id",
  as: "products",
});
Product.belongsTo(Category, {
  foreignKey: "category_id",
  as: "category",
});

// User - Sale (One to Many)
User.hasMany(Sale, {
  foreignKey: "user_id",
  as: "sales",
});
Sale.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

// Sale - SaleItem (One to Many)
Sale.hasMany(SaleItem, {
  foreignKey: "sale_id",
  as: "items",
});
SaleItem.belongsTo(Sale, {
  foreignKey: "sale_id",
  as: "sale",
});

StockAdjustment.belongsTo(Product, { foreignKey: "product_id" });
StockAdjustment.belongsTo(User, { foreignKey: "user_id" });
Product.hasMany(StockAdjustment, { foreignKey: "product_id" });

// Product - SaleItem (One to Many)
Product.hasMany(SaleItem, {
  foreignKey: "product_id",
  as: "sale_items",
});
SaleItem.belongsTo(Product, {
  foreignKey: "product_id",
  as: "product",
});

Sale.hasMany(SaleItem, { foreignKey: "sale_id" });
SaleItem.belongsTo(Sale, { foreignKey: "sale_id" });

// Sale.belongsTo(Shift, { foreignKey: "shift_id" });
// Shift.hasMany(Sale, { foreignKey: "shift_id" });

// Shift.belongsTo(User, { foreignKey: "id" });
// User.hasMany(Shift, { foreignKey: "shift_id" });

// Production ↔ ProductionItem
Production.hasMany(ProductionItem, {
  foreignKey: "production_id",
  as: "items",
});

ProductionItem.belongsTo(Production, {
  foreignKey: "production_id",
  as: "production",
});

// Who submitted
Production.belongsTo(User, {
  foreignKey: "submitted_by",
  as: "submittedBy",
});

// Who approved
Production.belongsTo(User, {
  foreignKey: "approved_by",
  as: "approvedBy",
});

// Who rejected
Production.belongsTo(User, {
  foreignKey: "rejected_by",
  as: "rejectedBy",
});
// ProductionItem ↔ Product
ProductionItem.belongsTo(Product, {
  foreignKey: "product_id",
  as: "product",
});

Product.hasMany(ProductionItem, {
  foreignKey: "product_id",
  as: "production_items",
});

// In Shift.js
Shift.hasMany(Sale, { foreignKey: "shift_id", as: "sales" });

// In Sale.js
Sale.belongsTo(Shift, { foreignKey: "shift_id", as: "shift" });
// shift to user relationship
// Shift ↔ User (cashier)
User.hasMany(Shift, { foreignKey: "cashier_id", as: "cashierShifts" });
Shift.belongsTo(User, { foreignKey: "cashier_id", as: "cashier" });

// Shift ↔ User (creator/owner)
User.hasMany(Shift, { foreignKey: "user_id", as: "createdShifts" });
Shift.belongsTo(User, {
  foreignKey: "user_id",
  as: "creator",
  constraints: false,
});

// ----------------------RETURNS Relationships ----------------

// Sale ↔ SaleItem
Sale.hasMany(SaleItem, { foreignKey: "sale_id" });
SaleItem.belongsTo(Sale, { foreignKey: "sale_id" });

// Product ↔ SaleItem
Product.hasMany(SaleItem, { foreignKey: "product_id" });
SaleItem.belongsTo(Product, { foreignKey: "product_id" });

// Sale ↔ Return
Sale.hasMany(Return, { foreignKey: "sale_id" });
Return.belongsTo(Sale, { foreignKey: "sale_id" });

// SaleItem ↔ Return (new link)
SaleItem.hasMany(Return, { foreignKey: "sale_item_id" });
Return.belongsTo(SaleItem, { foreignKey: "sale_item_id" });

// Product ↔ Return (optional, since SaleItem already links to Product)
Product.hasMany(Return, { foreignKey: "product_id" });
Return.belongsTo(Product, { foreignKey: "product_id" });

// Requested by (cashier)
User.hasMany(Return, { foreignKey: "requested_by", as: "RequestedReturns" });
Return.belongsTo(User, { foreignKey: "requested_by", as: "Requester" });

// Approved by (admin)

User.hasMany(Return, { foreignKey: "approved_by", as: "ApprovedReturns" });
Return.belongsTo(User, { foreignKey: "approved_by", as: "Approver" });

// A damage report belongs to a product
Damage.belongsTo(Product, { foreignKey: "product_id", as: "product" });

// A damage report belongs to a user (reporter)
Damage.belongsTo(User, { foreignKey: "reported_by", as: "reporter" });

// User ↔ Notification
User.hasMany(Notification, { foreignKey: "userId", as: "notifications" });
Notification.belongsTo(User, { foreignKey: "userId", as: "user" });

// Associations of PriceChange with Product and User
PriceChange.belongsTo(Product, { foreignKey: "product_id", as: "product" });
Product.hasMany(PriceChange, { foreignKey: "product_id", as: "price_changes" }); // to reverse on manyto-one relationship

PriceChange.belongsTo(User, { foreignKey: "changed_by", as: "changedBy" });

// Report associations
User.hasMany(Report, { foreignKey: "generated_by", as: "reports" });
Report.belongsTo(User, { foreignKey: "generated_by", as: "generatedBy" });

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
  ProductionItem,
  Return,
  Expense,
  ExpenseCategory,
  Damage,
  Notification,
  PriceChange,
  Report,
};

export default db;
