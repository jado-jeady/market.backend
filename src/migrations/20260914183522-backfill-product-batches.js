"use strict";

export default {
  async up(queryInterface, Sequelize) {
    // Create a "migration batch" for every product that currently has stock
    // This preserves the current stock state and lets old and new coexist
    await queryInterface.sequelize.query(`
      INSERT INTO product_batches 
        (product_id, batch_code, buying_price, selling_price, stock_quantity, expire_date, received_date, is_active, created_at, updated_at)
      SELECT 
        p.id,
        CONCAT('MIG-', COALESCE(p.sku, p.id::text), '-', TO_CHAR(NOW(), 'YYYYMMDD')),
        COALESCE(p.buying_price, p.selling_price * 0.7),
        p.selling_price,
        p.stock_quantity,
        p.expire_date,
        NOW(),
        (p.stock_quantity > 0),
        NOW(),
        NOW()
      FROM products p
      WHERE p.track_stock = true
        AND p.stock_quantity > 0
      ON CONFLICT DO NOTHING;
    `);

    console.log(
      "✅ Backfill complete: created migration batches for existing stock.",
    );
  },

  async down(queryInterface) {
    // Remove only migration-created batches
    await queryInterface.sequelize.query(`
      DELETE FROM product_batches WHERE batch_code LIKE 'MIG-%';
    `);
  },
};
