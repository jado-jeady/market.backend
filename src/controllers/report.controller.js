// controllers/report.controller.js
import db from "../models/index.js";
const { Report, Sale, Product, User, Category, SaleItem } = db;
import { Op } from "sequelize";
import sequelize from "../config/database.js";
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Generate Sales Report
export const generateSalesReport = async (req, res) => {
  try {
    const { dateRange, reportName } = req.body;
    const { from, to } = dateRange;

    const sales = await Sale.findAll({
      where: {
        created_at: {
          [Op.between]: [new Date(from), new Date(to + "T23:59:59")],
        },
        status: "COMPLETED",
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "full_name", "email"],
        },
        {
          model: SaleItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["id", "name", "barcode"],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    const totalSales = sales.length;
    const totalRevenue = sales.reduce(
      (sum, s) => sum + parseFloat(s.total_amount || 0),
      0,
    );
    const totalVAT = sales.reduce(
      (sum, s) => sum + parseFloat(s.vat_total || 0),
      0,
    );
    const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

    const paymentMethods = {};
    const categorySales = {};

    sales.forEach((sale) => {
      const method = sale.payment_method?.toUpperCase() || "OTHER";
      paymentMethods[method] = (paymentMethods[method] || 0) + 1;

      if (sale.items) {
        sale.items.forEach((item) => {
          const category = item.product?.category?.name || "Uncategorized";
          categorySales[category] =
            (categorySales[category] || 0) + item.quantity * item.unit_price;
        });
      }
    });

    const reportData = {
      type: "sales",
      name: reportName || `Sales Report ${from} to ${to}`,
      dateRange: { from, to },
      generated_at: new Date().toISOString(),
      summary: {
        total_sales: totalSales,
        total_revenue: totalRevenue,
        total_vat: totalVAT,
        average_order_value: averageOrderValue,
        payment_methods: paymentMethods,
        category_sales: categorySales,
      },
      data: sales,
    };

    const report = await Report.create({
      report_type: "sales",
      report_name: reportData.name,
      generated_by: req.user.id,
      date_range_from: from,
      date_range_to: to,
      parameters: { ...req.body },
      summary: reportData.summary,
      status: "generated",
    });

    res.json({
      success: true,
      message: "Sales report generated successfully",
      data: { ...reportData, report_id: report.id },
    });
  } catch (error) {
    console.error("Error generating sales report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate sales report",
      error: error.message,
    });
  }
};

// Generate Stock Report
export const generateStockReport = async (req, res) => {
  try {
    const { dateRange, reportName } = req.body;
    const products = await Product.findAll({
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["id", "name"],
        },
      ],
      order: [["name", "ASC"]],
    });

    const totalProducts = products.length;
    const totalStockValue = products.reduce(
      (sum, p) =>
        sum +
        parseFloat(p.stock_quantity || 0) * parseFloat(p.buying_price || 0),
      0,
    );
    const totalStockRetailValue = products.reduce(
      (sum, p) =>
        sum +
        parseFloat(p.stock_quantity || 0) * parseFloat(p.selling_price || 0),
      0,
    );

    const lowStockItems = products.filter(
      (p) => p.stock_quantity <= p.min_stock,
    );
    const outOfStockItems = products.filter((p) => p.stock_quantity === 0);

    const categoryStock = {};
    products.forEach((p) => {
      const cat = p.category?.name || "Uncategorized";
      if (!categoryStock[cat]) {
        categoryStock[cat] = {
          total: 0,
          value: 0,
          items: 0,
        };
      }
      categoryStock[cat].total += p.stock_quantity;
      categoryStock[cat].value += p.stock_quantity * p.buying_price;
      categoryStock[cat].items += 1;
    });

    const reportData = {
      type: "stock",
      name: reportName || `Stock Report ${dateRange.from} to ${dateRange.to}`,
      dateRange: dateRange,
      generated_at: new Date().toISOString(),
      summary: {
        total_products: totalProducts,
        total_stock_value: totalStockValue,
        total_stock_retail_value: totalStockRetailValue,
        low_stock_items: lowStockItems.length,
        out_of_stock_items: outOfStockItems.length,
        category_stock: categoryStock,
      },
      data: products,
    };

    const report = await Report.create({
      report_type: "stock",
      report_name: reportData.name,
      generated_by: req.user.id,
      date_range_from: dateRange.from,
      date_range_to: dateRange.to,
      parameters: { ...req.body },
      summary: reportData.summary,
      status: "generated",
    });

    res.json({
      success: true,
      message: "Stock report generated successfully",
      data: { ...reportData, report_id: report.id },
    });
  } catch (error) {
    console.error("Error generating stock report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate stock report",
      error: error.message,
    });
  }
};

// Generate Financial Report
export const generateFinancialReport = async (req, res) => {
  try {
    const { dateRange, reportName } = req.body;
    const { from, to } = dateRange;

    const sales = await Sale.findAll({
      where: {
        created_at: {
          [Op.between]: [new Date(from), new Date(to + "T23:59:59")],
        },
        status: "COMPLETED",
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "full_name"],
        },
      ],
    });

    const totalRevenue = sales.reduce(
      (sum, s) => sum + parseFloat(s.total_amount || 0),
      0,
    );
    const totalVAT = sales.reduce(
      (sum, s) => sum + parseFloat(s.vat_total || 0),
      0,
    );
    const totalDiscounts = sales.reduce(
      (sum, s) => sum + parseFloat(s.discount_amount || 0),
      0,
    );
    const totalTransactions = sales.length;

    const dailyRevenue = {};
    sales.forEach((sale) => {
      // Ensure created_at is a Date
      const dateObj = new Date(sale.created_at);

      // Format to YYYY-MM-DD
      const date = dateObj.toISOString().split("T")[0];

      if (!dailyRevenue[date]) {
        dailyRevenue[date] = 0;
      }
      dailyRevenue[date] += parseFloat(sale.total_amount || 0);
    });

    const topCashiers = {};
    sales.forEach((sale) => {
      const name = sale.user?.full_name || "Unknown";
      if (!topCashiers[name]) {
        topCashiers[name] = {
          transactions: 0,
          revenue: 0,
        };
      }
      topCashiers[name].transactions += 1;
      topCashiers[name].revenue += parseFloat(sale.total_amount || 0);
    });

    const reportData = {
      type: "financial",
      name: reportName || `Financial Report ${from} to ${to}`,
      dateRange: dateRange,
      generated_at: new Date().toISOString(),
      summary: {
        total_revenue: totalRevenue,
        total_vat: totalVAT,
        total_discounts: totalDiscounts,
        net_revenue: totalRevenue - totalVAT,
        total_transactions: totalTransactions,
        average_transaction:
          totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
        daily_revenue: dailyRevenue,
        top_cashiers: Object.entries(topCashiers)
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10),
      },
      data: sales,
    };

    const report = await Report.create({
      report_type: "financial",
      report_name: reportData.name,
      generated_by: req.user.id,
      date_range_from: from,
      date_range_to: to,
      parameters: { ...req.body },
      summary: reportData.summary,
      status: "generated",
    });

    res.json({
      success: true,
      message: "Financial report generated successfully",
      data: { ...reportData, report_id: report.id },
    });
  } catch (error) {
    console.error("Error generating financial report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate financial report",
      error: error.message,
    });
  }
};

// Generate Customer Report
export const generateCustomerReport = async (req, res) => {
  try {
    const { dateRange, reportName } = req.body;
    const { from, to } = dateRange;

    const sales = await Sale.findAll({
      where: {
        created_at: {
          [Op.between]: [new Date(from), new Date(to + "T23:59:59")],
        },
        status: "COMPLETED",
        customer_name: {
          [Op.not]: null,
        },
      },
    });

    const customerData = {};
    sales.forEach((sale) => {
      const name = sale.customer_name || "Walk-in";
      if (!customerData[name]) {
        customerData[name] = {
          name,
          phone: sale.customer_phone || "N/A",
          total_spent: 0,
          total_transactions: 0,
          last_purchase: sale.created_at,
          first_purchase: sale.created_at,
        };
      }
      customerData[name].total_spent += parseFloat(sale.total_amount || 0);
      customerData[name].total_transactions += 1;
      if (sale.created_at > customerData[name].last_purchase) {
        customerData[name].last_purchase = sale.created_at;
      }
      if (sale.created_at < customerData[name].first_purchase) {
        customerData[name].first_purchase = sale.created_at;
      }
    });

    const topCustomers = Object.values(customerData)
      .sort((a, b) => b.total_spent - a.total_spent)
      .slice(0, 20);

    const reportData = {
      type: "customer",
      name: reportName || `Customer Report ${from} to ${to}`,
      dateRange: dateRange,
      generated_at: new Date().toISOString(),
      summary: {
        total_customers: Object.keys(customerData).length,
        total_customer_spent: topCustomers.reduce(
          (sum, c) => sum + c.total_spent,
          0,
        ),
        average_customer_spent:
          Object.keys(customerData).length > 0
            ? Object.values(customerData).reduce(
                (sum, c) => sum + c.total_spent,
                0,
              ) / Object.keys(customerData).length
            : 0,
        top_customers: topCustomers,
      },
      data: topCustomers,
    };

    const report = await Report.create({
      report_type: "customer",
      report_name: reportData.name,
      generated_by: req.user.id,
      date_range_from: from,
      date_range_to: to,
      parameters: { ...req.body },
      summary: reportData.summary,
      status: "generated",
    });

    res.json({
      success: true,
      message: "Customer report generated successfully",
      data: { ...reportData, report_id: report.id },
    });
  } catch (error) {
    console.error("Error generating customer report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate customer report",
      error: error.message,
    });
  }
};

// Generate Category Report
export const generateCategoryReport = async (req, res) => {
  try {
    const { dateRange, reportName } = req.body;
    const { from, to } = dateRange;

    const sales = await Sale.findAll({
      where: {
        created_at: {
          [Op.between]: [new Date(from), new Date(to + "T23:59:59")],
        },
        status: "COMPLETED",
      },
      include: [
        {
          model: SaleItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
              include: [
                {
                  model: Category,
                  as: "category",
                },
              ],
            },
          ],
        },
      ],
    });

    const categoryData = {};
    sales.forEach((sale) => {
      if (sale.items) {
        sale.items.forEach((item) => {
          const category = item.product?.category?.name || "Uncategorized";
          if (!categoryData[category]) {
            categoryData[category] = {
              name: category,
              total_sales: 0,
              total_items: 0,
              total_revenue: 0,
            };
          }
          categoryData[category].total_sales += 1;
          categoryData[category].total_items += item.quantity;
          categoryData[category].total_revenue +=
            item.quantity * item.unit_price;
        });
      }
    });

    const categories = Object.values(categoryData).sort(
      (a, b) => b.total_revenue - a.total_revenue,
    );

    const reportData = {
      type: "category",
      name: reportName || `Category Report ${from} to ${to}`,
      dateRange: dateRange,
      generated_at: new Date().toISOString(),
      summary: {
        total_categories: categories.length,
        total_revenue: categories.reduce((sum, c) => sum + c.total_revenue, 0),
        top_category: categories[0] || null,
        categories: categories,
      },
      data: categories,
    };

    const report = await Report.create({
      report_type: "category",
      report_name: reportData.name,
      generated_by: req.user.id,
      date_range_from: from,
      date_range_to: to,
      parameters: { ...req.body },
      summary: reportData.summary,
      status: "generated",
    });

    res.json({
      success: true,
      message: "Category report generated successfully",
      data: { ...reportData, report_id: report.id },
    });
  } catch (error) {
    console.error("Error generating category report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate category report",
      error: error.message,
    });
  }
};

// Download Report as Excel
export const downloadReportExcel = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await Report.findByPk(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    let data = [];
    let headers = [];

    // Parse report data based on type
    switch (report.report_type) {
      case "sales":
        const salesData = report.summary;
        data = [
          { Metric: "Total Sales", Value: salesData.total_sales },
          { Metric: "Total Revenue", Value: salesData.total_revenue },
          { Metric: "Total VAT", Value: salesData.total_vat },
          {
            Metric: "Average Order Value",
            Value: salesData.average_order_value,
          },
        ];
        headers = ["Metric", "Value"];
        break;

      case "stock":
        const stockData = report.summary;
        data = [
          { Metric: "Total Products", Value: stockData.total_products },
          { Metric: "Total Stock Value", Value: stockData.total_stock_value },
          { Metric: "Low Stock Items", Value: stockData.low_stock_items },
          { Metric: "Out of Stock Items", Value: stockData.out_of_stock_items },
        ];
        headers = ["Metric", "Value"];
        break;

      case "financial":
        const financialData = report.summary;
        data = [
          { Metric: "Total Revenue", Value: financialData.total_revenue },
          { Metric: "Total VAT", Value: financialData.total_vat },
          { Metric: "Total Discounts", Value: financialData.total_discounts },
          {
            Metric: "Total Transactions",
            Value: financialData.total_transactions,
          },
        ];
        headers = ["Metric", "Value"];
        break;

      default:
        data = []; // Provide default empty data
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    // Update report status
    await report.update({
      status: "downloaded",
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${report.report_name}.xlsx`,
    );
    res.send(buffer);
  } catch (error) {
    console.error("Error downloading report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to download report",
      error: error.message,
    });
  }
};

// Get All Reports
export const getAllReports = async (req, res) => {
  try {
    const { limit = 50, offset = 0, type, status } = req.query;

    const where = {};
    if (type) where.report_type = type;
    if (status) where.status = status;

    const reports = await Report.findAndCountAll({
      where,
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: User,
          as: "generatedBy",
          attributes: ["id", "full_name", "email"],
        },
      ],
    });

    res.json({
      success: true,
      data: reports.rows,
      total: reports.count,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reports",
      error: error.message,
    });
  }
};

// Get Single Report
export const getReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await Report.findByPk(id, {
      include: [
        {
          model: User,
          as: "generatedBy",
          attributes: ["id", "full_name", "email"],
        },
      ],
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error("Error fetching report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch report",
      error: error.message,
    });
  }
};
