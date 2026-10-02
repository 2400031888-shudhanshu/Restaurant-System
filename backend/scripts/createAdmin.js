// Creates an admin account, or promotes an existing account to admin.
// Usage:
//   npm run create-admin -- "Full Name" admin@example.com "StrongPassword123"
// or set ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD in the environment.
require("dotenv").config();

const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");

async function main() {
    const [argName, argEmail, argPassword] = process.argv.slice(2);
    const name = (argName || process.env.ADMIN_NAME || "Administrator").trim();
    const email = (argEmail || process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const password = argPassword || process.env.ADMIN_PASSWORD || "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Provide a valid email: npm run create-admin -- "Name" admin@example.com "Password"');
    }
    if (password.length < 8 || password.length > 72) {
        throw new Error("Password must be between 8 and 72 characters.");
    }

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || "restaurant_db",
        port: Number(process.env.DB_PORT) || 3306
    });

    try {
        const hash = await bcrypt.hash(password, 10);
        const [existing] = await connection.query("SELECT user_id FROM users WHERE email = ?", [email]);

        if (existing.length > 0) {
            await connection.query(
                "UPDATE users SET role = 'ADMIN', is_active = 1, password = ?, name = ? WHERE user_id = ?",
                [hash, name, existing[0].user_id]
            );
            console.log(`✅ Existing account ${email} is now an active ADMIN (password updated).`);
        } else {
            await connection.query(
                "INSERT INTO users (name, email, password, role, is_active) VALUES (?, ?, ?, 'ADMIN', 1)",
                [name, email, hash]
            );
            console.log(`✅ Admin account created for ${email}.`);
        }
    } finally {
        await connection.end();
    }
}

main().catch(error => {
    console.error("❌", error.message);
    process.exit(1);
});
