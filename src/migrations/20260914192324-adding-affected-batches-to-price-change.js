"use strict";

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("price_changes", "affected_batch_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: "Which batch was affected (null for product-wide changes)",
      references: {
        model: "product_batches",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    // Adding an index for faster lookups when querying by batch
    await queryInterface.addIndex("price_changes", ["affected_batch_id"], {
      name: "price_changes_affected_batch_id_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "price_changes",
      "price_changes_affected_batch_id_idx",
    );
    await queryInterface.removeColumn("price_changes", "affected_batch_id");
  },
};
