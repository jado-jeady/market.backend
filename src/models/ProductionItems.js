import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

class ProductionItem extends Model {}

ProductionItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    production_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
      },
    },

    production_time: {
      type: DataTypes.TIME,
      allowNull: true,
    },

    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'ProductionItem',
    tableName: 'production_items',
    timestamps: true,
    underscored: true,
  }
);

export default ProductionItem;