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
    barcode: {
      type: DataTypes.STRING,
      allowNull: false,
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
    stock_quantity: {
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
    expiry_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    low_stock_threshold: {
      type: DataTypes.INTEGER,
      defaultValue: 10
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
    underscored: true,
    hooks: {
      beforeValidate: (product) => {
        if (product.selling_price <= product.buying_price) {
          throw new Error('Selling price must be greater than buying price');
        }
      }
    }
  }
);

export default Product;