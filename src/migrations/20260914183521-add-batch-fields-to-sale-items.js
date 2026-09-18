"use strict";

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("sale_items", "batch_id", {
      type: Sequelize.INTEGER,
      allowNull: true, // NULL for old sales
      references: {
        model: "product_batches",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn("sale_items", "buying_price", {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true, // NULL for old sales
      comment: "Snapshot of buying price at time of sale",
    });

    await queryInterface.addColumn("sale_items", "profit_margin", {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true,
      comment: "(unit_price - buying_price) * quantity",
    });

    // Index for fast batch lookups on reports
    await queryInterface.addIndex("sale_items", ["batch_id"], {
      name: "sale_items_batch_id_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("sale_items", "sale_items_batch_id_idx");
    await queryInterface.removeColumn("sale_items", "profit_margin");
    await queryInterface.removeColumn("sale_items", "buying_price");
    await queryInterface.removeColumn("sale_items", "batch_id");
  },
};
