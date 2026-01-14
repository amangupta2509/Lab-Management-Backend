console.log("Migration script ready");
/**
 * Database Migration & Cleanup Script
 * Run: node scripts/migrate.js
 *
 * This script will:
 * 1. Check existing database structure
 * 2. Add missing columns for mobile OAuth
 * 3. Clean up invalid/orphaned data
 * 4. Optimize tables
 * 5. Create indexes if missing
 */

require("dotenv").config();
const mysql = require("mysql2/promise");
const readline = require("readline");
const AUTO_CONFIRM = process.env.AUTO_MIGRATE === "true";

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function prompt(question) {
  // Auto-confirm when running on Railway / production
  if (process.env.AUTO_MIGRATE === "true") {
    log(`⚡ Auto-confirm enabled → ${question}`, "yellow");
    return Promise.resolve(true);
  }

  // Normal interactive prompt for local usage
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

// Database connection
let connection;

async function connectDatabase() {
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306,
      multipleStatements: true,
    });
    log("✅ Connected to database", "green");
    return true;
  } catch (error) {
    log(`❌ Database connection failed: ${error.message}`, "red");
    return false;
  }
}

// 1. Check and add missing OAuth columns
async function migrateOAuthColumns() {
  log("\n📋 Step 1: Checking OAuth columns...", "cyan");

  try {
    const [columns] = await connection.execute(
      `SHOW COLUMNS FROM users WHERE Field IN ('google_id', 'oauth_provider', 'email_verified', 'avatar_url')`
    );

    const existingColumns = columns.map((col) => col.Field);
    const requiredColumns = [
      "google_id",
      "oauth_provider",
      "email_verified",
      "avatar_url",
    ];
    const missingColumns = requiredColumns.filter(
      (col) => !existingColumns.includes(col)
    );

    if (missingColumns.length === 0) {
      log("  ✅ All OAuth columns exist", "green");
      return true;
    }

    log(`  ⚠️  Missing columns: ${missingColumns.join(", ")}`, "yellow");

    const migrations = [];

    if (missingColumns.includes("google_id")) {
      migrations.push(`
        ALTER TABLE users 
        ADD COLUMN google_id VARCHAR(255) AFTER password,
        ADD INDEX idx_google_id (google_id)
      `);
    }

    if (missingColumns.includes("oauth_provider")) {
      migrations.push(`
        ALTER TABLE users 
        ADD COLUMN oauth_provider ENUM('local','google') DEFAULT 'local' AFTER google_id,
        ADD INDEX idx_oauth_provider (oauth_provider)
      `);
    }

    if (missingColumns.includes("email_verified")) {
      migrations.push(`
        ALTER TABLE users 
        ADD COLUMN email_verified BOOLEAN DEFAULT FALSE AFTER oauth_provider
      `);
    }

    if (missingColumns.includes("avatar_url")) {
      migrations.push(`
        ALTER TABLE users 
        ADD COLUMN avatar_url VARCHAR(500) AFTER profile_image
      `);
    }

    for (const migration of migrations) {
      await connection.execute(migration);
      log("  ✅ Added missing column", "green");
    }

    // Update existing users to have local oauth_provider
    await connection.execute(`
      UPDATE users 
      SET oauth_provider = 'local' 
      WHERE oauth_provider IS NULL AND password IS NOT NULL
    `);

    log("  ✅ OAuth columns migration completed", "green");
    return true;
  } catch (error) {
    log(`  ❌ OAuth migration failed: ${error.message}`, "red");
    return false;
  }
}

// 2. Clean up orphaned records
async function cleanupOrphanedRecords() {
  log("\n🧹 Step 2: Cleaning up orphaned records...", "cyan");

  try {
    // Find and delete orphaned bookings (equipment deleted)
    const [orphanedBookings] = await connection.execute(`
      SELECT COUNT(*) as count FROM bookings b
      LEFT JOIN equipment e ON b.equipment_id = e.id
      WHERE e.id IS NULL
    `);

    if (orphanedBookings[0].count > 0) {
      log(
        `  ⚠️  Found ${orphanedBookings[0].count} orphaned bookings`,
        "yellow"
      );

      await connection.execute(`
        DELETE FROM bookings 
        WHERE equipment_id NOT IN (SELECT id FROM equipment)
      `);

      log(
        `  ✅ Deleted ${orphanedBookings[0].count} orphaned bookings`,
        "green"
      );
    } else {
      log("  ✅ No orphaned bookings found", "green");
    }

    // Find and delete orphaned usage sessions
    const [orphanedSessions] = await connection.execute(`
      SELECT COUNT(*) as count FROM equipment_usage_sessions eus
      LEFT JOIN bookings b ON eus.booking_id = b.id
      WHERE b.id IS NULL
    `);

    if (orphanedSessions[0].count > 0) {
      log(
        `  ⚠️  Found ${orphanedSessions[0].count} orphaned usage sessions`,
        "yellow"
      );

      await connection.execute(`
        DELETE FROM equipment_usage_sessions 
        WHERE booking_id NOT IN (SELECT id FROM bookings)
      `);

      log(
        `  ✅ Deleted ${orphanedSessions[0].count} orphaned sessions`,
        "green"
      );
    } else {
      log("  ✅ No orphaned usage sessions found", "green");
    }

    // Find and delete orphaned notifications
    const [orphanedNotifications] = await connection.execute(`
      SELECT COUNT(*) as count FROM notifications n
      LEFT JOIN users u ON n.user_id = u.id
      WHERE u.id IS NULL
    `);

    if (orphanedNotifications[0].count > 0) {
      log(
        `  ⚠️  Found ${orphanedNotifications[0].count} orphaned notifications`,
        "yellow"
      );

      await connection.execute(`
        DELETE FROM notifications 
        WHERE user_id NOT IN (SELECT id FROM users)
      `);

      log(
        `  ✅ Deleted ${orphanedNotifications[0].count} orphaned notifications`,
        "green"
      );
    } else {
      log("  ✅ No orphaned notifications found", "green");
    }

    return true;
  } catch (error) {
    log(`  ❌ Cleanup failed: ${error.message}`, "red");
    return false;
  }
}

// 3. Fix invalid data
async function fixInvalidData() {
  log("\n🔧 Step 3: Fixing invalid data...", "cyan");

  try {
    // Fix bookings with invalid time ranges
    const [invalidBookings] = await connection.execute(`
      SELECT COUNT(*) as count FROM bookings 
      WHERE end_time <= start_time
    `);

    if (invalidBookings[0].count > 0) {
      log(
        `  ⚠️  Found ${invalidBookings[0].count} bookings with invalid time ranges`,
        "yellow"
      );
      log("  ℹ️  These bookings will be marked as cancelled", "blue");

      await connection.execute(`
        UPDATE bookings 
        SET status = 'cancelled', 
            remarks = 'Auto-cancelled: Invalid time range'
        WHERE end_time <= start_time AND status = 'pending'
      `);

      log(`  ✅ Fixed invalid bookings`, "green");
    } else {
      log("  ✅ No invalid booking time ranges found", "green");
    }

    // Fix activity logs with invalid durations
    const [invalidActivity] = await connection.execute(`
      SELECT COUNT(*) as count FROM activity_logs 
      WHERE sign_out_time IS NOT NULL AND sign_out_time < sign_in_time
    `);

    if (invalidActivity[0].count > 0) {
      log(
        `  ⚠️  Found ${invalidActivity[0].count} activity logs with invalid times`,
        "yellow"
      );

      await connection.execute(`
        UPDATE activity_logs 
        SET sign_out_time = NULL
        WHERE sign_out_time IS NOT NULL AND sign_out_time < sign_in_time
      `);

      log(`  ✅ Fixed invalid activity logs`, "green");
    } else {
      log("  ✅ No invalid activity logs found", "green");
    }

    // Ensure all local auth users have passwords
    const [usersWithoutPassword] = await connection.execute(`
      SELECT COUNT(*) as count FROM users 
      WHERE oauth_provider = 'local' AND (password IS NULL OR password = '')
    `);

    if (usersWithoutPassword[0].count > 0) {
      log(
        `  ⚠️  Found ${usersWithoutPassword[0].count} local users without passwords`,
        "yellow"
      );
      log("  ℹ️  These accounts will be deactivated", "blue");

      await connection.execute(`
        UPDATE users 
        SET is_active = FALSE, 
            remarks = 'Deactivated: No password set'
        WHERE oauth_provider = 'local' AND (password IS NULL OR password = '')
      `);

      log(`  ✅ Deactivated users without passwords`, "green");
    } else {
      log("  ✅ All local users have passwords", "green");
    }

    return true;
  } catch (error) {
    log(`  ❌ Data fix failed: ${error.message}`, "red");
    return false;
  }
}

// 4. Add missing indexes for performance
async function addMissingIndexes() {
  log("\n⚡ Step 4: Checking and adding indexes...", "cyan");

  try {
    const indexesToCheck = [
      {
        table: "users",
        index: "idx_google_id",
        column: "google_id",
        query: "CREATE INDEX idx_google_id ON users(google_id)",
      },
      {
        table: "users",
        index: "idx_oauth_provider",
        column: "oauth_provider",
        query: "CREATE INDEX idx_oauth_provider ON users(oauth_provider)",
      },
      {
        table: "bookings",
        index: "idx_composite_booking",
        column: "equipment_id, booking_date, status",
        query:
          "CREATE INDEX idx_composite_booking ON bookings(equipment_id, booking_date, status)",
      },
      {
        table: "notifications",
        index: "idx_composite_notifications",
        column: "user_id, is_read, created_at",
        query:
          "CREATE INDEX idx_composite_notifications ON notifications(user_id, is_read, created_at)",
      },
      {
        table: "activity_logs",
        index: "idx_activity_date",
        column: "activity_date",
        query: "CREATE INDEX idx_activity_date ON activity_logs(activity_date)",
      },
    ];

    for (const indexInfo of indexesToCheck) {
      const [indexes] = await connection.execute(`
        SHOW INDEX FROM ${indexInfo.table} WHERE Key_name = '${indexInfo.index}'
      `);

      if (indexes.length === 0) {
        try {
          await connection.execute(indexInfo.query);
          log(
            `  ✅ Added index ${indexInfo.index} on ${indexInfo.table}`,
            "green"
          );
        } catch (error) {
          if (error.code === "ER_DUP_KEYNAME") {
            log(`  ℹ️  Index ${indexInfo.index} already exists`, "blue");
          } else {
            log(
              `  ⚠️  Could not add index ${indexInfo.index}: ${error.message}`,
              "yellow"
            );
          }
        }
      } else {
        log(
          `  ✅ Index ${indexInfo.index} exists on ${indexInfo.table}`,
          "green"
        );
      }
    }

    return true;
  } catch (error) {
    log(`  ❌ Index creation failed: ${error.message}`, "red");
    return false;
  }
}

// 5. Optimize tables
async function optimizeTables() {
  log("\n🚀 Step 5: Optimizing tables...", "cyan");

  try {
    const tables = [
      "users",
      "equipment",
      "bookings",
      "equipment_usage_sessions",
      "activity_logs",
      "lab_logbook",
      "notifications",
      "print_logs",
    ];

    for (const table of tables) {
      await connection.execute(`OPTIMIZE TABLE ${table}`);
      log(`  ✅ Optimized ${table}`, "green");
    }

    return true;
  } catch (error) {
    log(`  ❌ Optimization failed: ${error.message}`, "red");
    return false;
  }
}

// 6. Generate database statistics
async function generateStatistics() {
  log("\n📊 Step 6: Generating database statistics...", "cyan");

  try {
    const [userStats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_users,
        SUM(CASE WHEN oauth_provider = 'google' THEN 1 ELSE 0 END) as google_users,
        SUM(CASE WHEN oauth_provider = 'local' THEN 1 ELSE 0 END) as local_users
      FROM users
    `);

    const [equipmentStats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_equipment,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN status = 'in_use' THEN 1 ELSE 0 END) as in_use,
        SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance,
        SUM(CASE WHEN status = 'deleted' THEN 1 ELSE 0 END) as deleted
      FROM equipment
    `);

    const [bookingStats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_bookings,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM bookings
    `);

    const [activityStats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_sessions,
        COALESCE(SUM(duration_minutes), 0) as total_minutes,
        COALESCE(ROUND(SUM(duration_minutes) / 60, 2), 0) as total_hours
      FROM activity_logs
    `);

    log("\n" + "=".repeat(60), "blue");
    log("📊 DATABASE STATISTICS", "blue");
    log("=".repeat(60), "blue");

    log("\n👥 Users:", "cyan");
    log(`  Total: ${userStats[0].total_users}`, "white");
    log(`  Active: ${userStats[0].active_users}`, "white");
    log(`  Google Auth: ${userStats[0].google_users}`, "white");
    log(`  Local Auth: ${userStats[0].local_users}`, "white");

    log("\n🔬 Equipment:", "cyan");
    log(`  Total: ${equipmentStats[0].total_equipment}`, "white");
    log(`  Available: ${equipmentStats[0].available}`, "white");
    log(`  In Use: ${equipmentStats[0].in_use}`, "white");
    log(`  Maintenance: ${equipmentStats[0].maintenance}`, "white");
    log(`  Deleted: ${equipmentStats[0].deleted}`, "white");

    log("\n📅 Bookings:", "cyan");
    log(`  Total: ${bookingStats[0].total_bookings}`, "white");
    log(`  Pending: ${bookingStats[0].pending}`, "white");
    log(`  Approved: ${bookingStats[0].approved}`, "white");
    log(`  Completed: ${bookingStats[0].completed}`, "white");
    log(`  Cancelled: ${bookingStats[0].cancelled}`, "white");
    log(`  Rejected: ${bookingStats[0].rejected}`, "white");

    log("\n⏱️  Activity:", "cyan");
    log(`  Total Sessions: ${activityStats[0].total_sessions}`, "white");
    log(`  Total Hours: ${activityStats[0].total_hours}`, "white");

    log("\n" + "=".repeat(60) + "\n", "blue");

    return true;
  } catch (error) {
    log(`  ❌ Statistics generation failed: ${error.message}`, "red");
    return false;
  }
}

// 7. Create backup before migration (optional)
async function createBackup() {
  log("\n💾 Creating backup...", "cyan");

  const shouldBackup = await prompt(
    "  Do you want to create a backup before migration? (y/n): "
  );

  if (!shouldBackup) {
    log("  ⏭️  Skipping backup", "yellow");
    return true;
  }

  try {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .split("T")[0];
    const backupFile = `backup_${timestamp}.sql`;

    log(`  ℹ️  Creating backup: ${backupFile}`, "blue");
    log("  ℹ️  Please run this command manually:", "blue");
    log(
      `  mysqldump -u ${process.env.DB_USER} -p ${process.env.DB_NAME} > ${backupFile}`,
      "yellow"
    );

    const confirmed = await prompt("  Have you created the backup? (y/n): ");

    if (!confirmed) {
      log("  ❌ Migration cancelled - backup required", "red");
      return false;
    }

    return true;
  } catch (error) {
    log(`  ❌ Backup check failed: ${error.message}`, "red");
    return false;
  }
}

// Main migration function
async function runMigration() {
  log("\n" + "=".repeat(60), "magenta");
  log("🔄 LAB MANAGEMENT SYSTEM - DATABASE MIGRATION", "magenta");
  log("=".repeat(60) + "\n", "magenta");

  log("This script will:", "cyan");
  log("  1. Add missing OAuth columns", "white");
  log("  2. Clean up orphaned records", "white");
  log("  3. Fix invalid data", "white");
  log("  4. Add missing indexes", "white");
  log("  5. Optimize tables", "white");
  log("  6. Generate statistics\n", "white");

  const shouldContinue = await prompt("Do you want to continue? (y/n): ");

  if (!shouldContinue) {
    log("\n❌ Migration cancelled by user", "red");
    process.exit(0);
  }

  // Connect to database
  const connected = await connectDatabase();
  if (!connected) {
    process.exit(1);
  }

  // Create backup
  const backupCreated = await createBackup();
  if (!backupCreated) {
    await connection.end();
    process.exit(1);
  }

  let success = true;

  // Run migrations
  success = (await migrateOAuthColumns()) && success;
  success = (await cleanupOrphanedRecords()) && success;
  success = (await fixInvalidData()) && success;
  success = (await addMissingIndexes()) && success;
  success = (await optimizeTables()) && success;
  await generateStatistics();

  // Close connection
  await connection.end();
  log("\n✅ Database connection closed", "green");

  if (success) {
    log("\n" + "=".repeat(60), "green");
    log("✅ MIGRATION COMPLETED SUCCESSFULLY", "green");
    log("=".repeat(60) + "\n", "green");
  } else {
    log("\n" + "=".repeat(60), "yellow");
    log("⚠️  MIGRATION COMPLETED WITH WARNINGS", "yellow");
    log("=".repeat(60) + "\n", "yellow");
  }
}

// Handle errors
process.on("unhandledRejection", async (error) => {
  log(`\n❌ Unhandled error: ${error.message}`, "red");
  if (connection) {
    await connection.end();
  }
  process.exit(1);
});

// Run migration
runMigration().catch(async (error) => {
  log(`\n❌ Migration failed: ${error.message}`, "red");
  if (connection) {
    await connection.end();
  }
  process.exit(1);
});
