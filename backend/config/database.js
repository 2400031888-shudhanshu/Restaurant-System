const mysql = require("mysql2");

// A connection pool (instead of one long-lived connection) so the app keeps
// working after MySQL closes idle connections or restarts.
const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "restaurant_db",
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_SIZE) || 10,
    queueLimit: 0,
    connectTimeout: 10000,
    enableKeepAlive: true,
    charset: "utf8mb4"
});

// Fail loudly at start-up if the database is unreachable or not set up.
pool.checkConnection = function checkConnection() {
    return new Promise((resolve, reject) => {
        pool.query("SELECT COUNT(*) AS tables_found FROM information_schema.tables " +
            "WHERE table_schema = DATABASE() AND table_name IN ('users','orders','food_items')",
        (error, rows) => {
            if (error) {
                return reject(error);
            }
            if (Number(rows[0].tables_found) < 3) {
                return reject(new Error(
                    "Database schema not found. Run `npm run db:setup` in the backend folder."
                ));
            }
            return resolve();
        });
    });
};

module.exports = pool;
