"use strict";

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("product_batches", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      product_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "products",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      batch_code: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      buying_price: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      selling_price: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      stock_quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      expire_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      received_date: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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

    // Critical indexes for FIFO performance
    await queryInterface.addIndex(
      "product_batches",
      ["product_id", "is_active", "stock_quantity"],
      { name: "product_batches_fifo_idx" },
    );

    await queryInterface.addIndex("product_batches", ["expire_date"], {
      name: "product_batches_expiry_idx",
    });

    await queryInterface.addIndex("product_batches", ["batch_code"], {
      name: "product_batches_code_idx",
      unique: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("product_batches");
  },
};
