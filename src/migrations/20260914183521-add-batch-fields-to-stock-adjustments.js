"use strict";

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("stock_adjustments", "batch_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "product_batches",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn("stock_adjustments", "batch_code", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addIndex("stock_adjustments", ["batch_id"], {
      name: "stock_adjustments_batch_id_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "stock_adjustments",
      "stock_adjustments_batch_id_idx",
    );
    await queryInterface.removeColumn("stock_adjustments", "batch_code");
    await queryInterface.removeColumn("stock_adjustments", "batch_id");
  },
};
