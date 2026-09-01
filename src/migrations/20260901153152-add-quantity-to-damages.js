import { Sequelize } from "sequelize";

/** @type {import('sequelize-cli').Migration} */
export async function up(queryInterface, Sequelize) {
  await queryInterface.addColumn("damages", "quantity", {
    type: Sequelize.INTEGER, // Adjust to Sequelize.DECIMAL(15,2) if fractional units are used
    allowNull: false, // Set to true if old reports can have empty quantities
    defaultValue: 1, // Prevents older historical data rows from crashing
  });
}

export async function down(queryInterface, Sequelize) {
  // If we rollback, remove the column safely
  await queryInterface.removeColumn("damages", "quantity");
}
