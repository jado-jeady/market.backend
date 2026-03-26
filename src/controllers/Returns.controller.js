import db from "../models/index.js";
import { Sequelize, Op } from "sequelize";
import sequelize from "../config/database.js";

const { SaleItem, Product, Return } = db;

/* ==================HANDLING A RETURN SALE====================*/

export const createReturn = async (req, res) => {
  try {
    const { sale_id, items, requested_by } = req.body;

    // Validate sale items
    for (const item of items) {
      const saleItem = await SaleItem.findOne({
        where: { sale_id, product_id: item.product_id },
      });
      if (!saleItem || item.quantity > saleItem.quantity) {
        return res.status(400).json({ error: "Invalid return quantity" });
      }
    }

    // Save return requests
    const returnRequests = await Promise.all(
      items.map((item) =>
        Return.create({
          sale_id,
          product_id: item.product_id,
          quantity: item.quantity,
          reason: item.reason,
          requested_by,
          status: "PENDING",
        }),
      ),
    );

    res.json(returnRequests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create return request" });
  }
};

/*---------------------- Rejecting a return sale by admin --------------------------*/

export const rejectReturn = async (req, res) => {
  try {
    const { return_id, approved_by } = req.body;

    const returnRequest = await Return.findByPk(return_id);
    if (!returnRequest)
      return res.status(404).json({ error: "Return not found" });

    returnRequest.status = "REJECTED";
    returnRequest.approved_by = approved_by;
    await returnRequest.save();

    res.json(returnRequest);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reject return" });
  }
};

//APPROVING A RETURNED SALE
export const approveReturn = async (req, res) => {
  try {
    const { return_id, approved_by } = req.body;

    const returnRequest = await Return.findByPk(return_id);
    if (!returnRequest)
      return res.status(404).json({ error: "Return not found" });

    // Update stock only on approval
    if (returnRequest.status === "PENDING") {
      const product = await Product.findByPk(returnRequest.product_id);
      product.stock += returnRequest.quantity;
      await product.save();

      returnRequest.status = "APPROVED";
      returnRequest.approved_by = approved_by;
      await returnRequest.save();
    }

    res.json(returnRequest);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to approve return" });
  }
};
