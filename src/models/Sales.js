import { Model, DataTypes } from "sequelize";
import sequelize from "../config/database.js";
import Shift from "./Shifts.js";

class Sale extends Model {}

Sale.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    invoice_number: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Cashier who made the sale",
    },

    shift_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "shifts",
        key: "id",
      },
      onDelete: "CASCADE",
    },

    customer_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    customer_phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    payment_method: {
      type: DataTypes.ENUM("cash", "momo", "card"),
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM("COMPLETED", "CANCELLED", "PENDING", "REFUNDED"),
      defaultValue: "COMPLETED",
    },

    subtotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },

    vat_total: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },

    total_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "Sale",
    tableName: "sales",
    timestamps: true,
    underscored: true,
    createdAt: "created_at",
    updatedAt: false,
  },
);

export default Sale;
