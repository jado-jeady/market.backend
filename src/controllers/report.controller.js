// controllers/report.controller.js
import db from "../models/index.js";
import { Op, fn, col, literal, QueryTypes } from "sequelize";
import sequelize from "../config/database.js";

const {
  Sale,
  SaleItem,
  Product,
  ProductBatch,
  User,
  Shift,
  StockAdjustment,
  Category,
  PriceChange,
  Report,
} = db;

/* ============================================================
   HELPER: resolve date range
============================================================ */
const resolveRange = (from, to) => {
  const fromDate = from
    ? new Date(`${from}T00:00:00`)
    : new Date(new Date().setHours(0, 0, 0, 0));
  const toDate = to
    ? new Date(`${to}T23:59:59.999`)
    : new Date(new Date().setHours(23, 59, 59, 999));
  return { fromDate, toDate };
};

/* ============================================================
   1. SALES REPORT
   Group by day/week/month, payment method, cashier, shift
============================================================ */
export const getSalesReport = async (req, res, next) => {
  try {
    const {
      from,
      to,
      group_by = "day", // day | week | month
      cashier_id,
      payment_method,
      shift_id,
    } = req.query;

    const { fromDate, toDate } = resolveRange(from, to);

    const where = {
      created_at: { [Op.between]: [fromDate, toDate] },
      status: { [Op.in]: ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"] },
    };
    if (cashier_id) where.user_id = cashier_id;
    if (payment_method) where.payment_method = payment_method;
    if (shift_id) where.shift_id = shift_id;

    const sales = await Sale.findAll({
      where,
      include: [
        { model: User, as: "user", attributes: ["id", "full_name"] },
        { model: Shift, as: "shift", attributes: ["id", "business_date"] },
      ],
      order: [["created_at", "ASC"]],
    });

    // Totals
    const totalRevenue = sales.reduce(
      (s, x) => s + parseFloat(x.total_amount || 0),
      0,
    );
    const totalVat = sales.reduce(
      (s, x) => s + parseFloat(x.vat_total || 0),
      0,
    );
    const totalSubtotal = sales.reduce(
      (s, x) => s + parseFloat(x.subtotal || 0),
      0,
    );

    // By payment method
    const byPayment = {};
    for (const s of sales) {
      const key = s.payment_method || "unknown";
      if (!byPayment[key]) byPayment[key] = { count: 0, revenue: 0 };
      byPayment[key].count += 1;
      byPayment[key].revenue += parseFloat(s.total_amount || 0);
    }

    // By cashier
    const byCashier = {};
    for (const s of sales) {
      const key = s.user_id;
      if (!byCashier[key]) {
        byCashier[key] = {
          user_id: key,
          name: s.user?.full_name || "Unknown",
          count: 0,
          revenue: 0,
        };
      }
      byCashier[key].count += 1;
      byCashier[key].revenue += parseFloat(s.total_amount || 0);
    }

    // By shift
    const byShift = {};
    for (const s of sales) {
      const key = s.shift_id || "no-shift";
      if (!byShift[key]) {
        byShift[key] = {
          shift_id: key,
          business_date: s.shift?.business_date || null,
          count: 0,
          revenue: 0,
        };
      }
      byShift[key].count += 1;
      byShift[key].revenue += parseFloat(s.total_amount || 0);
    }

    // Time series (day / week / month)
    const series = {};
    for (const s of sales) {
      const d = new Date(s.created_at);
      let key;
      if (group_by === "month") {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      } else if (group_by === "week") {
        const onejan = new Date(d.getFullYear(), 0, 1);
        const week = Math.ceil(
          ((d - onejan) / 86400000 + onejan.getDay() + 1) / 7,
        );
        key = `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
      } else {
        key = d.toISOString().slice(0, 10);
      }
      if (!series[key])
        series[key] = { period: key, count: 0, revenue: 0, vat: 0 };
      series[key].count += 1;
      series[key].revenue += parseFloat(s.total_amount || 0);
      series[key].vat += parseFloat(s.vat_total || 0);
    }

    res.json({
      success: true,
      data: {
        summary: {
          total_transactions: sales.length,
          total_subtotal: totalSubtotal,
          total_vat: totalVat,
          total_revenue: totalRevenue,
          average_order: sales.length > 0 ? totalRevenue / sales.length : 0,
        },
        by_payment: Object.values(byPayment),
        by_cashier: Object.values(byCashier).sort(
          (a, b) => b.revenue - a.revenue,
        ),
        by_shift: Object.values(byShift),
        series: Object.values(series).sort((a, b) =>
          a.period.localeCompare(b.period),
        ),
      },
    });
  } catch (error) {
    console.error("getSalesReport error:", error);
    next(error);
  }
};

/* ============================================================
   2. PROFIT REPORT
   Uses sale_items.profit_margin (frozen at sale time)
   Groups: product, batch, day
============================================================ */
export const getProfitReport = async (req, res, next) => {
  try {
    const { from, to, group_by = "product" } = req.query;
    const { fromDate, toDate } = resolveRange(from, to);

    console.log(
      `getProfitReport: from=${fromDate.toISOString()} to=${toDate.toISOString()} group_by=${group_by}`,
    );
    // Fetch all sale items in range
    const items = await SaleItem.findAll({
      include: [
        {
          model: Sale,
          as: "sale",
          attributes: ["id", "invoice_number", "created_at", "status"],
          where: {
            created_at: { [Op.between]: [fromDate, toDate] },
            status: {
              [Op.in]: ["COMPLETED"],
            },
          },
        },
        {
          model: Product,
          as: "product",
          attributes: ["id", "name", "barcode", "sku"],
        },
        {
          model: ProductBatch,
          as: "batch",
          attributes: ["id", "batch_code"],
        },
      ],
    });

    // Overall totals
    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;
    let lossCount = 0;

    // By product
    const byProduct = {};
    // By batch
    const byBatch = {};
    // By day
    const byDay = {};

    for (const item of items) {
      const qty = parseInt(item.quantity || 0);
      const unitPrice = parseFloat(item.unit_price || 0);
      const buyingPrice = parseFloat(item.buying_price || 0);
      const lineRevenue = unitPrice * qty;
      const lineCost = buyingPrice * qty;
      const lineProfit = lineRevenue - lineCost;

      totalRevenue += lineRevenue;
      totalCost += lineCost;
      totalProfit += lineProfit;
      if (lineProfit < 0) lossCount += 1;

      // By product
      const pid = item.product_id;
      if (!byProduct[pid]) {
        byProduct[pid] = {
          product_id: pid,
          name: item.product?.name || "Unknown",
          barcode: item.product?.barcode || null,
          sku: item.product?.sku || null,
          quantity_sold: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
          loss_lines: 0,
        };
      }
      byProduct[pid].quantity_sold += qty;
      byProduct[pid].revenue += lineRevenue;
      byProduct[pid].cost += lineCost;
      byProduct[pid].profit += lineProfit;
      if (lineProfit < 0) byProduct[pid].loss_lines += 1;

      // By batch
      const bid = item.batch_id || "no-batch";
      if (!byBatch[bid]) {
        byBatch[bid] = {
          batch_id: item.batch_id,
          batch_code: item.batch?.batch_code || "—",
          product_id: pid,
          product_name: item.product?.name || "Unknown",
          quantity_sold: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
        };
      }
      byBatch[bid].quantity_sold += qty;
      byBatch[bid].revenue += lineRevenue;
      byBatch[bid].cost += lineCost;
      byBatch[bid].profit += lineProfit;

      // By day
      const saleDate = item.sale?.created_at
        ? new Date(item.sale.created_at).toISOString().slice(0, 10)
        : "unknown";
      if (!byDay[saleDate]) {
        byDay[saleDate] = {
          date: saleDate,
          quantity_sold: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
        };
      }
      byDay[saleDate].quantity_sold += qty;
      byDay[saleDate].revenue += lineRevenue;
      byDay[saleDate].cost += lineCost;
      byDay[saleDate].profit += lineProfit;
    }

    // Add margin % to each group
    const addMargins = (rows) =>
      rows.map((r) => ({
        ...r,
        profit_margin_pct:
          r.revenue > 0 ? Math.round((r.profit / r.revenue) * 10000) / 100 : 0,
      }));

    res.json({
      success: true,
      data: {
        summary: {
          total_lines: items.length,
          total_revenue: totalRevenue,
          total_cost: totalCost,
          total_profit: totalProfit,
          profit_margin_pct:
            totalRevenue > 0
              ? Math.round((totalProfit / totalRevenue) * 10000) / 100
              : 0,
          loss_lines: lossCount,
        },
        group_by,
        by_product: addMargins(
          Object.values(byProduct).sort((a, b) => b.profit - a.profit),
        ),
        by_batch: addMargins(
          Object.values(byBatch).sort((a, b) => b.profit - a.profit),
        ),
        by_day: addMargins(
          Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
        ),
      },
    });
  } catch (error) {
    console.error("getProfitReport error:", error);
    next(error);
  }
};

/* ============================================================
   3. VAT REPORT
   18% standard, 0% zero-rated/exempt. Extracted from sales.
============================================================ */
export const getVatReport = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const { fromDate, toDate } = resolveRange(from, to);

    // Fetch sale items with their product VAT category
    const items = await SaleItem.findAll({
      include: [
        {
          model: Sale,
          as: "sale",
          attributes: ["id", "invoice_number", "created_at"],
          where: {
            created_at: { [Op.between]: [fromDate, toDate] },
            status: {
              [Op.in]: ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"],
            },
          },
        },
        {
          model: Product,
          as: "product",
          attributes: ["id", "name", "barcode", "vat_category"],
        },
      ],
    });

    // Aggregate by VAT category
    const byCategory = {
      STANDARD: {
        category: "STANDARD",
        rate: 18,
        lines: 0,
        gross: 0,
        vat: 0,
        net: 0,
      },
      ZERO_RATED: {
        category: "ZERO_RATED",
        rate: 0,
        lines: 0,
        gross: 0,
        vat: 0,
        net: 0,
      },
      EXEMPT: {
        category: "EXEMPT",
        rate: 0,
        lines: 0,
        gross: 0,
        vat: 0,
        net: 0,
      },
    };

    // Daily totals
    const byDay = {};

    // By product (only standard VAT products)
    const byProduct = {};

    for (const item of items) {
      const cat = item.product?.vat_category || "STANDARD";
      const qty = parseInt(item.quantity || 0);
      const unitPrice = parseFloat(item.unit_price || 0);
      const lineTotal = parseFloat(item.total_price || 0) || unitPrice * qty;

      // VAT is 18% of the VAT-inclusive price: VAT = gross * 18 / 118
      // Zero-rated and exempt: vat = 0
      let vatAmount = 0;
      let netAmount = lineTotal;
      if (cat === "STANDARD") {
        vatAmount = (lineTotal * 18) / 118;
        netAmount = lineTotal - vatAmount;
      }

      const bucket = byCategory[cat] || byCategory.STANDARD;
      bucket.lines += 1;
      bucket.gross += lineTotal;
      bucket.vat += vatAmount;
      bucket.net += netAmount;

      const date = item.sale?.created_at
        ? new Date(item.sale.created_at).toISOString().slice(0, 10)
        : "unknown";
      if (!byDay[date]) {
        byDay[date] = { date, gross: 0, vat: 0, net: 0 };
      }
      byDay[date].gross += lineTotal;
      byDay[date].vat += vatAmount;
      byDay[date].net += netAmount;

      if (cat === "STANDARD") {
        const pid = item.product_id;
        if (!byProduct[pid]) {
          byProduct[pid] = {
            product_id: pid,
            name: item.product?.name || "Unknown",
            barcode: item.product?.barcode || null,
            qty: 0,
            gross: 0,
            vat: 0,
            net: 0,
          };
        }
        byProduct[pid].qty += qty;
        byProduct[pid].gross += lineTotal;
        byProduct[pid].vat += vatAmount;
        byProduct[pid].net += netAmount;
      }
    }

    const totalVat = Object.values(byCategory).reduce((s, c) => s + c.vat, 0);
    const totalGross = Object.values(byCategory).reduce(
      (s, c) => s + c.gross,
      0,
    );
    const totalNet = Object.values(byCategory).reduce((s, c) => s + c.net, 0);

    res.json({
      success: true,
      data: {
        summary: {
          total_gross: Math.round(totalGross * 100) / 100,
          total_vat: Math.round(totalVat * 100) / 100,
          total_net: Math.round(totalNet * 100) / 100,
        },
        by_category: Object.values(byCategory).map((c) => ({
          ...c,
          gross: Math.round(c.gross * 100) / 100,
          vat: Math.round(c.vat * 100) / 100,
          net: Math.round(c.net * 100) / 100,
        })),
        by_day: Object.values(byDay)
          .map((d) => ({
            ...d,
            gross: Math.round(d.gross * 100) / 100,
            vat: Math.round(d.vat * 100) / 100,
            net: Math.round(d.net * 100) / 100,
          }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        by_product: Object.values(byProduct)
          .map((p) => ({
            ...p,
            gross: Math.round(p.gross * 100) / 100,
            vat: Math.round(p.vat * 100) / 100,
            net: Math.round(p.net * 100) / 100,
          }))
          .sort((a, b) => b.vat - a.vat),
      },
    });
  } catch (error) {
    console.error("getVatReport error:", error);
    next(error);
  }
};

/* ============================================================
   4. SHIFT REPORT
   Per shift: total sales, expected vs actual cash, difference
============================================================ */
export const getShiftReport = async (req, res, next) => {
  try {
    const { from, to, cashier_id } = req.query;
    const { fromDate, toDate } = resolveRange(from, to);

    const where = {
      created_at: { [Op.between]: [fromDate, toDate] },
    };
    if (cashier_id) where.cashier_id = cashier_id;

    const shifts = await Shift.findAll({
      where,
      include: [
        { model: User, as: "cashier", attributes: ["id", "full_name"] },
        {
          model: Sale,
          as: "sales",
          attributes: ["id", "total_amount", "payment_method", "status"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    const rows = shifts.map((s) => {
      const salesList = s.sales || [];
      const completedSales = salesList.filter((x) =>
        ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(x.status),
      );

      const totalSales = completedSales.reduce(
        (sum, x) => sum + parseFloat(x.total_amount || 0),
        0,
      );

      const cashSales = completedSales
        .filter((x) => x.payment_method === "cash")
        .reduce((sum, x) => sum + parseFloat(x.total_amount || 0), 0);
      const momoSales = completedSales
        .filter((x) => x.payment_method === "momo")
        .reduce((sum, x) => sum + parseFloat(x.total_amount || 0), 0);
      const cardSales = completedSales
        .filter((x) => x.payment_method === "card")
        .reduce((sum, x) => sum + parseFloat(x.total_amount || 0), 0);

      const opening = parseFloat(s.opening_balance || 0);
      const closing = parseFloat(s.closing_balance || 0);
      const petty = parseFloat(s.petty_cash || 0);
      const cashInHand = parseFloat(s.cash_in_hand || 0);

      // Expected cash = opening + cash sales - withdrawals
      const withdrawal = parseFloat(s.cash_withdrawal || 0);
      const expectedCash = opening + cashSales - withdrawal;

      // Actual counted cash
      const actualCash = cashInHand || closing;

      const difference = actualCash - expectedCash;

      return {
        shift_id: s.id,
        cashier: s.cashier?.full_name || "Unknown",
        cashier_id: s.cashier_id,
        business_date: s.business_date,
        status: s.status,
        opened_at: s.opened_at,
        closed_at: s.closed_at,
        opening_balance: opening,
        closing_balance: closing,
        petty_cash: petty,
        cash_in_hand: cashInHand,
        cash_withdrawal: withdrawal,
        total_sales: totalSales,
        transaction_count: completedSales.length,
        cash_sales: cashSales,
        momo_sales: momoSales,
        card_sales: cardSales,
        expected_cash: expectedCash,
        actual_cash: actualCash,
        difference,
        is_balanced: Math.abs(difference) < 1, // within 1 RWF tolerance
      };
    });

    const totalDifference = rows.reduce((s, r) => s + r.difference, 0);
    const totalRevenue = rows.reduce((s, r) => s + r.total_sales, 0);
    const balancedCount = rows.filter((r) => r.is_balanced).length;
    const shortCount = rows.filter((r) => r.difference < -1).length;
    const overCount = rows.filter((r) => r.difference > 1).length;

    res.json({
      success: true,
      data: {
        summary: {
          total_shifts: rows.length,
          total_revenue: totalRevenue,
          total_difference: totalDifference,
          balanced_shifts: balancedCount,
          short_shifts: shortCount,
          over_shifts: overCount,
        },
        shifts: rows,
      },
    });
  } catch (error) {
    console.error("getShiftReport error:", error);
    next(error);
  }
};

/* ============================================================
   5. STOCK MOVEMENT REPORT
   From stock_adjustments — every IN/OUT with reason
============================================================ */
export const getStockMovementReport = async (req, res, next) => {
  try {
    const {
      from,
      to,
      product_id,
      type, // IN | OUT
      user_id,
      page = 1,
      limit = 100,
    } = req.query;

    const { fromDate, toDate } = resolveRange(from, to);
    const offset = (page - 1) * limit;

    const where = {
      created_at: { [Op.between]: [fromDate, toDate] },
    };
    if (product_id) where.product_id = product_id;
    if (type) where.type = type;
    if (user_id) where.user_id = user_id;

    const { count, rows } = await StockAdjustment.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [["created_at", "DESC"]],
      include: [
        {
          model: Product,
          as: "product",
          attributes: ["id", "name", "barcode"],
        },
        { model: User, as: "user", attributes: ["id", "full_name"] },
        { model: ProductBatch, as: "batch", attributes: ["id", "batch_code"] },
      ],
    });

    // Summary for the range
    const totals = await StockAdjustment.findAll({
      where,
      attributes: [
        "type",
        [fn("COUNT", col("id")), "count"],
        [fn("SUM", col("quantity")), "total_quantity"],
      ],
      group: ["type"],
      raw: true,
    });

    // Top movers (product with most adjustments)
    const topMovers = await StockAdjustment.findAll({
      where,
      attributes: [
        "product_id",
        [fn("COUNT", col("StockAdjustment.id")), "count"],
        [fn("SUM", col("quantity")), "net_quantity"],
      ],
      include: [{ model: Product, as: "product", attributes: ["name"] }],
      group: ["StockAdjustment.product_id", "product.id", "product.name"],
      order: [[literal('"count"'), "DESC"]],
      limit: 20,
      raw: true,
      nest: true,
    });

    return res.json({
      success: true,
      data: {
        data: rows,
        summary: { by_type: totals },
        top_movers: topMovers,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    console.error("getStockMovementReport error:", error);
    next(error);
  }
};
/* ============================================================
   6. PURCHASE REPORT
   IN-type stock adjustments (received stock)
============================================================ */
export const getPurchaseReport = async (req, res, next) => {
  try {
    const { from, to, product_id } = req.query;
    const { fromDate, toDate } = resolveRange(from, to);

    const where = {
      created_at: { [Op.between]: [fromDate, toDate] },
      type: "IN",
    };
    if (product_id) where.product_id = product_id;

    const adjustments = await StockAdjustment.findAll({
      where,
      include: [
        {
          model: Product,
          as: "product",
          attributes: ["id", "name", "barcode", "supplier"],
        },
        { model: User, as: "user", attributes: ["id", "full_name"] },
        { model: ProductBatch, as: "batch" },
      ],
      order: [["created_at", "DESC"]],
    });

    // Totals
    let totalUnits = 0;
    let totalCost = 0;

    // By product
    const byProduct = {};
    // By supplier (from product.supplier field)
    const bySupplier = {};
    // By day
    const byDay = {};

    for (const adj of adjustments) {
      const qty = parseInt(adj.quantity || 0);
      const unitCost = parseFloat(adj.batch?.buying_price || 0);
      const totalLineCost = qty * unitCost;

      totalUnits += qty;
      totalCost += totalLineCost;

      // By product
      const pid = adj.product_id;
      if (!byProduct[pid]) {
        byProduct[pid] = {
          product_id: pid,
          name: adj.product?.name || "Unknown",
          barcode: adj.product?.barcode || null,
          units: 0,
          cost: 0,
          events: 0,
        };
      }
      byProduct[pid].units += qty;
      byProduct[pid].cost += totalLineCost;
      byProduct[pid].events += 1;

      // By supplier
      const supplier = adj.product?.supplier || "Unassigned";
      if (!bySupplier[supplier]) {
        bySupplier[supplier] = { supplier, units: 0, cost: 0, events: 0 };
      }
      bySupplier[supplier].units += qty;
      bySupplier[supplier].cost += totalLineCost;
      bySupplier[supplier].events += 1;

      // By day — SAFE GUARD ADDED HERE
      const rawDate = adj.created_at ? new Date(adj.created_at) : new Date();
      const date = !isNaN(rawDate.getTime())
        ? rawDate.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10); // Fallback safely to current date string if corrupted

      if (!byDay[date]) byDay[date] = { date, units: 0, cost: 0, events: 0 };
      byDay[date].units += qty;
      byDay[date].cost += totalLineCost;
      byDay[date].events += 1;
    }

    return res.json({
      success: true,
      data: {
        summary: {
          total_events: adjustments.length,
          total_units: totalUnits,
          total_cost: totalCost,
        },
        by_product: Object.values(byProduct).sort((a, b) => b.cost - a.cost),
        by_supplier: Object.values(bySupplier).sort((a, b) => b.cost - a.cost),
        by_day: Object.values(byDay).sort((a, b) =>
          a.date.localeCompare(b.date),
        ),
        events: adjustments,
      },
    });
  } catch (error) {
    console.error("getPurchaseReport error:", error);
    next(error);
  }
};

/* ============================================================
   LIST AVAILABLE USERS / CATEGORIES (for filter dropdowns)
============================================================ */
export const getReportFilters = async (req, res, next) => {
  try {
    const cashiers = await User.findAll({
      where: { is_active: true },
      attributes: ["id", "full_name", "role"],
      order: [["full_name", "ASC"]],
    });
    const categories = await Category.findAll({
      attributes: ["id", "name"],
      order: [["name", "ASC"]],
    });
    return res.json({ success: true, data: { cashiers, categories } });
  } catch (error) {
    console.error("getReportFilters error:", error);
    next(error);
  }
};
