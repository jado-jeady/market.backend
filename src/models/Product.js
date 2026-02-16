import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

class Product extends Model {}

Product.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    sku: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true
    },
    
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'categories',
        key: 'id'
      }
    },

    barcode: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    buying_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    selling_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    stock_quantity: { //initial_stock for creation, updated with transactions
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    vat_category: {
      type: DataTypes.ENUM('STANDARD', 'ZERO_RATED', 'EXEMPT'),
      defaultValue: 'STANDARD'
    },
    expire_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    min_stock: {
      type: DataTypes.INTEGER,
      defaultValue:10 
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    supplier: {
      type: DataTypes.STRING,
      allowNull: true
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  },
  {
    sequelize,
    modelName: 'Product',
    tableName: 'products',
    timestamps: true,
    underscored: true
  }
);

export default Product;