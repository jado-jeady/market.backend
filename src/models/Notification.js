import { Model, DataTypes } from "sequelize";
import sequelize from "../config/database.js";

class Notification extends Model {}

Notification.init(
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("Admin", "Storekeeper", "Cashier", "Barista"),
      allowNull: false,
    },
    targetUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    userId: {
      type: DataTypes.BIGINT, // who triggered the notification
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "Notification",
    tableName: "notifications",
    timestamps: true,
  },
);

export default Notification;
