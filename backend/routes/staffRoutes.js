const express = require("express");
const bcrypt = require("bcryptjs");

const router = express.Router();
const db = require("../config/database");
const { verifyToken, requireAdmin } = require("../middleware/authMiddleware");

router.get("/", verifyToken, requireAdmin, (req, res) => {
    const sql = `
        SELECT user_id, name, email, phone, role, created_at
        FROM users
        WHERE role IN ('STAFF', 'DELIVERY') AND is_active = 1
        ORDER BY name, user_id
    `;

    db.query(sql, (error, staff) => {
        if (error) {
            console.error("Unable to load staff:", error);
            return res.status(500).json({ message: "Unable to load staff accounts." });
        }

        return res.json(staff);
    });
});

router.post("/", verifyToken, requireAdmin, async (req, res) => {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const phone = String(req.body.phone || "").trim();
    const password = String(req.body.password || "");
    const role = String(req.body.role || "STAFF").trim().toUpperCase();

    if (!["STAFF", "DELIVERY"].includes(role)) {
        return res.status(400).json({ message: "Choose a valid account type." });
    }

    if (!name || !email || !password) {
        return res.status(400).json({ message: "Name, email, and password are required." });
    }

    if (name.length > 100 || email.length > 100 || phone.length > 15) {
        return res.status(400).json({ message: "One or more fields exceed the allowed length." });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "Enter a valid email address." });
    }

    if (password.length < 8 || password.length > 72) {
        return res.status(400).json({ message: "Password must be between 8 and 72 characters." });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = `
            INSERT INTO users (name, email, password, phone, role, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
        `;

        db.query(sql, [name, email, hashedPassword, phone || null, role], (error, result) => {
            if (error?.code === "ER_DUP_ENTRY") {
                return res.status(409).json({ message: "An account with this email already exists." });
            }

            if (error) {
                console.error("Unable to create staff account:", error);
                return res.status(500).json({ message: "Unable to create staff account." });
            }

            return res.status(201).json({
                message: `${role === "DELIVERY" ? "Delivery" : "Staff"} account created.`,
                user_id: result.insertId
            });
        });
    } catch (error) {
        console.error("Unable to hash staff password:", error);
        return res.status(500).json({ message: "Unable to create staff account." });
    }
});

router.delete("/:user_id", verifyToken, requireAdmin, (req, res) => {
    const userId = Number(req.params.user_id);

    if (!Number.isInteger(userId) || userId < 1) {
        return res.status(400).json({ message: "Invalid staff account ID." });
    }

    db.query(
        "UPDATE users SET is_active = 0 WHERE user_id = ? AND role IN ('STAFF', 'DELIVERY') AND is_active = 1",
        [userId],
        (error, result) => {
            if (error) {
                console.error("Unable to deactivate staff account:", error);
                return res.status(500).json({ message: "Unable to remove staff access." });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Active staff account not found." });
            }

            return res.json({ message: "Staff access removed. Order history was preserved." });
        }
    );
});

module.exports = router;