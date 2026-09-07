// migrations/20260905111736-update-report-date-fields-to-include-time.js
export default {
  up: async (queryInterface, Sequelize) => {
    console.log("🔍 Starting migration...");

    try {
      // Check current columns
      const columns = await queryInterface.describeTable("reports");

      // Check if already migrated (column is already TIMESTAMP)
      if (
        columns["date_range_from"]?.type?.includes("timestamp") &&
        columns["date_range_to"]?.type?.includes("timestamp")
      ) {
        console.log("✅ Already migrated, skipping...");
        return;
      }

      console.log(
        "📝 Converting date_range_from and date_range_to to TIMESTAMP...",
      );

      // Step 1: Add temporary columns
      await queryInterface.addColumn("reports", "date_range_from_temp", {
        type: Sequelize.DATE,
        allowNull: true,
      });

      await queryInterface.addColumn("reports", "date_range_to_temp", {
        type: Sequelize.DATE,
        allowNull: true,
      });

      // Step 2: Copy data from old columns to new ones
      await queryInterface.sequelize.query(`
        UPDATE reports 
        SET date_range_from_temp = date_range_from::timestamp,
            date_range_to_temp = date_range_to::timestamp
      `);

      // Step 3: Set defaults for any NULL values (should be none after truncate)
      await queryInterface.sequelize.query(`
        UPDATE reports 
        SET date_range_from_temp = COALESCE(date_range_from_temp, NOW()),
            date_range_to_temp = COALESCE(date_range_to_temp, NOW())
      `);

      // Step 4: Drop old columns
      await queryInterface.removeColumn("reports", "date_range_from");
      await queryInterface.removeColumn("reports", "date_range_to");

      // Step 5: Rename temp columns to final
      await queryInterface.renameColumn(
        "reports",
        "date_range_from_temp",
        "date_range_from",
      );
      await queryInterface.renameColumn(
        "reports",
        "date_range_to_temp",
        "date_range_to",
      );

      // Step 6: Make NOT NULL
      await queryInterface.changeColumn("reports", "date_range_from", {
        type: Sequelize.DATE,
        allowNull: false,
      });

      await queryInterface.changeColumn("reports", "date_range_to", {
        type: Sequelize.DATE,
        allowNull: false,
      });

      // Step 7: Clean up any extra columns
      const extraColumns = [
        "date_range_from_tz",
        "date_range_to_tz",
        "date_range_from_new",
        "date_range_to_new",
        "start_time",
        "end_time",
      ];

      for (const col of extraColumns) {
        try {
          const cols = await queryInterface.describeTable("reports");
          if (cols[col]) {
            await queryInterface.removeColumn("reports", col);
            console.log(`   ✅ Removed ${col}`);
          }
        } catch (e) {
          // Column doesn't exist, skip
        }
      }

      console.log("✅ Migration completed successfully!");
    } catch (error) {
      console.error("❌ Migration failed:", error.message);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log("↩️ Rolling back migration...");

    try {
      const columns = await queryInterface.describeTable("reports");

      // Only rollback if columns are TIMESTAMP
      if (columns["date_range_from"]?.type?.includes("timestamp")) {
        // Add temp DATEONLY columns
        await queryInterface.addColumn("reports", "date_range_from_temp", {
          type: Sequelize.DATEONLY,
          allowNull: true,
        });

        await queryInterface.addColumn("reports", "date_range_to_temp", {
          type: Sequelize.DATEONLY,
          allowNull: true,
        });

        // Copy data
        await queryInterface.sequelize.query(`
          UPDATE reports 
          SET date_range_from_temp = date_range_from::date,
              date_range_to_temp = date_range_to::date
        `);

        // Drop old columns
        await queryInterface.removeColumn("reports", "date_range_from");
        await queryInterface.removeColumn("reports", "date_range_to");

        // Rename temp to final
        await queryInterface.renameColumn(
          "reports",
          "date_range_from_temp",
          "date_range_from",
        );
        await queryInterface.renameColumn(
          "reports",
          "date_range_to_temp",
          "date_range_to",
        );

        // Make nullable
        await queryInterface.changeColumn("reports", "date_range_from", {
          type: Sequelize.DATEONLY,
          allowNull: true,
        });

        await queryInterface.changeColumn("reports", "date_range_to", {
          type: Sequelize.DATEONLY,
          allowNull: true,
        });
      }

      console.log("✅ Rollback completed successfully!");
    } catch (error) {
      console.error("❌ Rollback failed:", error.message);
      throw error;
    }
  },
};
