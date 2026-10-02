// Creates the database, tables and starter menu (idempotent).
// Usage: npm run db:setup
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

async function main() {
    const sqlPath = path.resolve(__dirname, "../../database/restaurant.sql");
    let sql = fs.readFileSync(sqlPath, "utf8");

    // Allow a different database name (e.g. for tests) via DB_NAME.
    const dbName = process.env.DB_NAME || "restaurant_db";
    if (!/^[A-Za-z0-9_]+$/.test(dbName)) {
        throw new Error("DB_NAME may only contain letters, numbers and underscores.");
    }
    sql = sql.replace(/restaurant_db/g, dbName);

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        port: Number(process.env.DB_PORT) || 3306,
        multipleStatements: true
    });

    try {
        await connection.query(sql);
        console.log(`✅ Database "${dbName}" is ready (tables created/upgraded, starter menu loaded).`);
    } finally {
        await connection.end();
    }
}

main().catch(error => {
    console.error("❌ Database setup failed:", error.message);
    process.exit(1);
});
