import { Sequelize } from "sequelize";

/** @type {import('sequelize-cli').Migration} */
export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable("price_changes", {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    product_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "products", // Name of the physical table in PostgreSQL
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    old_price: {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false,
    },
    new_price: {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false,
    },
    price_difference: {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false,
    },
    changed_by: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "users", // Name of the physical table in PostgreSQL
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "NO ACTION", // Safe default to protect historical log audits
    },
    change_reason: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    change_type: {
      type: Sequelize.ENUM("INCREASE", "DECREASE", "UPDATE"),
      allowNull: false,
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
  });
}

export async function down(queryInterface, Sequelize) {
  // 1. Drop the table first
  await queryInterface.dropTable("price_changes");

  // 2. Cleanly remove the custom ENUM type from PostgreSQL to avoid conflicts if recreated
  await queryInterface.sequelize.query(
    'DROP TYPE IF EXISTS "enum_price_changes_change_type";',
  );
}
