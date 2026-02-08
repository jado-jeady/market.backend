import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

class Sale extends Model {}

Sale.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    invoice_number: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    subtotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    vat_total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    payment_method: {
      type: DataTypes.ENUM('CASH', 'MOMO', 'CARD'),
      defaultValue: 'CASH'
    },
    status: {
      type: DataTypes.ENUM('COMPLETED', 'CANCELLED'),
      defaultValue: 'COMPLETED'
    }
  },
  {
    sequelize,
    modelName: 'Sale',
    tableName: 'sales',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: false
  }
);

export default Sale;