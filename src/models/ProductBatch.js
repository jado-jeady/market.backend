import { Model, DataTypes } from "sequelize";
import sequelize from "../config/database.js";

class ProductBatch extends Model {
  /**
   * Reduce stock for a sale, with automatic stock_adjustments logging.
   * MUST be called inside a transaction.
   */
  async consumeForSale(quantity, userId, reference, transaction) {
    if (quantity > this.stock_quantity) {
      throw new Error(
        `Insufficient stock in batch ${this.batch_code}. Available: ${this.stock_quantity}, Requested: ${quantity}`,
      );
    }

    const previous = this.stock_quantity;
    const next = previous - quantity;

    await this.update(
      { stock_quantity: next, is_active: next > 0 },
      { transaction },
    );

    const product = await sequelize.models.Product.findByPk(this.product_id, {
      transaction,
    });

    await sequelize.models.StockAdjustment.create(
      {
        product_id: this.product_id,
        batch_id: this.id,
        batch_code: this.batch_code,
        barcode: product.barcode,
        user_id: userId,
        type: "OUT",
        quantity,
        reason: reference,
        previous_stock: previous,
        new_stock: next,
      },
      { transaction },
    );

    return { previous, next };
  }

  /**
   * Add stock (e.g. purchase, return, production, positive adjustment).
   * MUST be called inside a transaction.
   */
  async addStock(quantity, userId, reason, transaction) {
    const previous = this.stock_quantity;
    const next = previous + quantity;

    await this.update(
      { stock_quantity: next, is_active: true },
      { transaction },
    );

    const product = await sequelize.models.Product.findByPk(this.product_id, {
      transaction,
    });

    await sequelize.models.StockAdjustment.create(
      {
        product_id: this.product_id,
        batch_id: this.id,
        batch_code: this.batch_code,
        barcode: product.barcode,
        user_id: userId,
        type: "IN",
        quantity,
        reason,
        previous_stock: previous,
        new_stock: next,
      },
      { transaction },
    );

    return { previous, next };
  }
}

ProductBatch.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    product_id: { type: DataTypes.INTEGER, allowNull: false },
    batch_code: { type: DataTypes.STRING, allowNull: false },
    buying_price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    selling_price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    stock_quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    expire_date: { type: DataTypes.DATE, allowNull: true },
    received_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: "ProductBatch",
    tableName: "product_batches",
    timestamps: true,
    underscored: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default ProductBatch;
