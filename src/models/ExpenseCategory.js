import { Model, DataTypes } from "sequelize";
import sequelize from "../config/database.js";

class ExpenseCategory extends Model {}

ExpenseCategory.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
  },
  {
    sequelize,
    modelName: "ExpenseCategory",
    tableName: "exp_categories",
    timestamps: true,
    underscored: true,
  },
);

export default ExpenseCategory;
