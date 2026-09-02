// migrations/20250101000000-create-reports.js
export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("reports", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      report_type: {
        type: Sequelize.ENUM(
          "sales",
          "stock",
          "financial",
          "customer",
          "product",
          "category",
        ),
        allowNull: false,
      },
      report_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      generated_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
      },
      date_range_from: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      date_range_to: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      file_path: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      file_name: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      file_size: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM("generated", "downloaded", "failed"),
        defaultValue: "generated",
      },
      parameters: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      summary: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("reports");
    // 2. Clean up both custom ENUM data types from the database
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_reports_report_type";',
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_reports_status";',
    );
  },
};
