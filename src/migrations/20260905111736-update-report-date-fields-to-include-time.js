// migrations/20260905111736-update-report-date-fields-to-include-time.js
export default {
  up: async (queryInterface, Sequelize) => {
    // Use transaction for safety
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log("🔍 Checking current table structure...");
      const columns = await queryInterface.describeTable("reports");

      // Check if we already have timestamp columns
      const hasTimestampFrom =
        columns["date_range_from"]?.type?.includes("timestamp");
      const hasTimestampTo =
        columns["date_range_to"]?.type?.includes("timestamp");

      // If already migrated, skip
      if (hasTimestampFrom && hasTimestampTo) {
        console.log("✅ Migration already applied, skipping...");
        await transaction.commit();
        return;
      }

      console.log("🔄 Starting migration...");

      // ---- HANDLE date_range_from ----
      if (!columns["date_range_from"]) {
        // Column doesn't exist, create it
        console.log("📝 Creating date_range_from column...");
        await queryInterface.addColumn(
          "reports",
          "date_range_from",
          {
            type: Sequelize.DATE,
            allowNull: true,
          },
          { transaction },
        );

        // Populate from existing columns if they exist
        if (columns["date_range_from_tz"]) {
          await queryInterface.sequelize.query(
            `
            UPDATE reports SET date_range_from = date_range_from_tz
          `,
            { transaction },
          );
        } else if (columns["date_range_from_new"]) {
          await queryInterface.sequelize.query(
            `
            UPDATE reports SET date_range_from = date_range_from_new
          `,
            { transaction },
          );
        }
      } else {
        // Column exists but might be DATEONLY
        const isDateOnly =
          !columns["date_range_from"].type?.includes("timestamp");

        if (isDateOnly) {
          console.log("📝 Converting date_range_from to timestamp...");
          // Add temp column
          await queryInterface.addColumn(
            "reports",
            "date_range_from_temp",
            {
              type: Sequelize.DATE,
              allowNull: true,
            },
            { transaction },
          );

          // Copy data with proper casting
          await queryInterface.sequelize.query(
            `
            UPDATE reports 
            SET date_range_from_temp = date_range_from::timestamp
          `,
            { transaction },
          );

          // Drop old column
          await queryInterface.removeColumn("reports", "date_range_from", {
            transaction,
          });

          // Rename temp to final
          await queryInterface.renameColumn(
            "reports",
            "date_range_from_temp",
            "date_range_from",
            { transaction },
          );
        }
      }

      // ---- HANDLE date_range_to ----
      if (!columns["date_range_to"]) {
        console.log("📝 Creating date_range_to column...");
        await queryInterface.addColumn(
          "reports",
          "date_range_to",
          {
            type: Sequelize.DATE,
            allowNull: true,
          },
          { transaction },
        );

        if (columns["date_range_to_tz"]) {
          await queryInterface.sequelize.query(
            `
            UPDATE reports SET date_range_to = date_range_to_tz
          `,
            { transaction },
          );
        } else if (columns["date_range_to_new"]) {
          await queryInterface.sequelize.query(
            `
            UPDATE reports SET date_range_to = date_range_to_new
          `,
            { transaction },
          );
        }
      } else {
        const isDateOnly =
          !columns["date_range_to"].type?.includes("timestamp");

        if (isDateOnly) {
          console.log("📝 Converting date_range_to to timestamp...");
          await queryInterface.addColumn(
            "reports",
            "date_range_to_temp",
            {
              type: Sequelize.DATE,
              allowNull: true,
            },
            { transaction },
          );

          await queryInterface.sequelize.query(
            `
            UPDATE reports 
            SET date_range_to_temp = date_range_to::timestamp
          `,
            { transaction },
          );

          await queryInterface.removeColumn("reports", "date_range_to", {
            transaction,
          });
          await queryInterface.renameColumn(
            "reports",
            "date_range_to_temp",
            "date_range_to",
            { transaction },
          );
        }
      }

      // ---- SET DEFAULTS FOR NULL VALUES ----
      console.log("📝 Setting defaults for NULL values...");
      await queryInterface.sequelize.query(
        `
        UPDATE reports 
        SET date_range_from = COALESCE(date_range_from, NOW()),
            date_range_to = COALESCE(date_range_to, NOW())
      `,
        { transaction },
      );

      // ---- MAKE NOT NULL ----
      console.log("📝 Making columns NOT NULL...");
      await queryInterface.changeColumn(
        "reports",
        "date_range_from",
        {
          type: Sequelize.DATE,
          allowNull: false,
        },
        { transaction },
      );

      await queryInterface.changeColumn(
        "reports",
        "date_range_to",
        {
          type: Sequelize.DATE,
          allowNull: false,
        },
        { transaction },
      );

      // ---- CLEAN UP EXTRA COLUMNS ----
      console.log("📝 Cleaning up extra columns...");
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
            await queryInterface.removeColumn("reports", col, { transaction });
            console.log(`   ✅ Removed ${col}`);
          }
        } catch (e) {
          // Column doesn't exist, skip
        }
      }

      await transaction.commit();
      console.log("✅ Migration completed successfully!");
    } catch (error) {
      console.error("❌ Migration failed! Rolling back...");
      await transaction.rollback();
      console.error("Error:", error.message);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log("↩️ Rolling back migration...");

      // Check current columns
      const columns = await queryInterface.describeTable("reports");

      // Only rollback if we have timestamp columns
      if (columns["date_range_from"]?.type?.includes("timestamp")) {
        // Add temp DATEONLY columns
        await queryInterface.addColumn(
          "reports",
          "date_range_from_temp",
          {
            type: Sequelize.DATEONLY,
            allowNull: true,
          },
          { transaction },
        );

        await queryInterface.addColumn(
          "reports",
          "date_range_to_temp",
          {
            type: Sequelize.DATEONLY,
            allowNull: true,
          },
          { transaction },
        );

        // Copy data
        await queryInterface.sequelize.query(
          `
          UPDATE reports 
          SET date_range_from_temp = date_range_from::date,
              date_range_to_temp = date_range_to::date
        `,
          { transaction },
        );

        // Drop old columns
        await queryInterface.removeColumn("reports", "date_range_from", {
          transaction,
        });
        await queryInterface.removeColumn("reports", "date_range_to", {
          transaction,
        });

        // Rename temp to final
        await queryInterface.renameColumn(
          "reports",
          "date_range_from_temp",
          "date_range_from",
          { transaction },
        );
        await queryInterface.renameColumn(
          "reports",
          "date_range_to_temp",
          "date_range_to",
          { transaction },
        );

        // Make nullable
        await queryInterface.changeColumn(
          "reports",
          "date_range_from",
          {
            type: Sequelize.DATEONLY,
            allowNull: true,
          },
          { transaction },
        );

        await queryInterface.changeColumn(
          "reports",
          "date_range_to",
          {
            type: Sequelize.DATEONLY,
            allowNull: true,
          },
          { transaction },
        );
      }

      await transaction.commit();
      console.log("✅ Rollback completed successfully!");
    } catch (error) {
      await transaction.rollback();
      console.error("❌ Rollback failed:", error.message);
      throw error;
    }
  },
};
