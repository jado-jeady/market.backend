import Product from "../models/Product.js";
import StockAdjustment from "../models/StockAdjustment.js";
import User from "../models/User.js";

export const adjustStock = async (req, res) => {
  try {
    const { product_id, barcode, type, quantity, reason } = req.body;
    const user_id = req.user.id; // from JWT

    if (!barcode || !type || !quantity || !reason) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const product = await Product.findOne({ where: { barcode } });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const previous_stock = product.stock_quantity;
    let new_stock;

    if (type === "IN") {
      new_stock = previous_stock + Number(quantity);
    } else {
      if (quantity > previous_stock) {
        return res.status(400).json({
          message: "Cannot reduce more than available stock",
        });
      }
      new_stock = previous_stock - Number(quantity);
    }

    // Update product stock
    await product.update({ stock_quantity: new_stock });

    // Save adjustment history
    const adjustment = await StockAdjustment.create({
      product_id: product.id,
      barcode: product.barcode,
      user_id,
      type,
      quantity,
      reason,
      previous_stock,
      new_stock,
    });

    res.status(200).json({
      success: true,
      message: "Stock adjusted successfully",
      data: adjustment,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};


// GETING STOCK ADJUSTMENTS


export const getStockAdjustments = async (req, res) => {
  try {
    
    const adjustments = await StockAdjustment.findAll({
      include: [
        {
          model: Product,
          attributes: ['name'], // Fetch product name for the table
        },
        {
          model: User,
          attributes: ['username'], // Optional: see who made the change
        }
      ],
      order: [['created_at', 'DESC']], // Match your underscored: true config
    });


    const response =res.status(200).json(adjustments);
    console.log(response)
    return response;
  } catch (error) {
    console.error("Fetch Adjustment Error:", error);
    res.status(500).json({ message: "Failed to retrieve stock history" });
  }
};

