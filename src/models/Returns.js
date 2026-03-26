import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";

class Return extends Model {}

Return.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    sale_id: {
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
    },
    reason: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("PENDING", "APPROVED", "REJECTED"),
      defaultValue: "PENDING",
    },
    requested_by: {
      type: DataTypes.INTEGER, // user_id of cashier
      allowNull: false,
    },
    approved_by: {
      type: DataTypes.INTEGER, // user_id of admin
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "Return",
    tableName: "returns",
    timestamps: true,
    underscored: true,
  },
);

export default Return;
