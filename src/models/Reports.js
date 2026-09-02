// models/Report.js
import { Model, DataTypes } from "sequelize";
import sequelize from "../config/database.js";

class Report extends Model {}

Report.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    report_type: {
      type: DataTypes.ENUM(
        "sales",
        "stock",
        "financial",
        "customer",
        "product",
        "category",
      ),
      allowNull: false,
    },
    report_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    generated_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    date_range_from: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    date_range_to: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    file_path: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    file_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    file_size: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("generated", "downloaded", "failed"),
      defaultValue: "generated",
    },
    parameters: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    summary: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: "Report",
    tableName: "reports",
    timestamps: true,
    underscored: true,
    createdAt: "created_at",
    updatedAt: false,
  },
);

export default Report;
