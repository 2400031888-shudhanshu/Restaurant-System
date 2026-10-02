const express = require("express");
const bcrypt = require("bcryptjs");

const router = express.Router();
const db = require("../config/database");
const { verifyToken, requireAdmin } = require("../middleware/authMiddleware");

router.get("/", verifyToken, requireAdmin, (req, res) => {
    const sql = `
        SELECT user_id, name, email, phone, role, is_active, created_at, last_login_at
        FROM users
        ORDER BY created_at DESC, user_id DESC
    `;

    db.query(sql, (error, accounts) => {
        if (error) {
            console.error("Unable to load accounts:", error);
            return res.status(500).json({ message: "Unable to load registered accounts." });
        }

        return res.json(accounts);
    });
});

router.put("/:user_id/access", verifyToken, requireAdmin, (req, res) => {
    const userId = Number(req.params.user_id);
    const isActive = req.body.is_active;

    if (!Number.isInteger(userId) || userId < 1 || typeof isActive !== "boolean") {
        return res.status(400).json({ message: "Provide a valid account ID and access state." });
    }

    if (!isActive && userId === Number(req.user.userId)) {
        return res.status(409).json({ message: "You cannot deactivate your own admin account." });
    }

    db.query(
        "SELECT role, is_active FROM users WHERE user_id = ?",
        [userId],
        (lookupError, rows) => {
            if (lookupError) {
                console.error("Unable to check account access:", lookupError);
                return res.status(500).json({ message: "Unable to update account access." });
            }

            if (!rows.length) {
                return res.status(404).json({ message: "Account not found." });
            }

            const updateAccess = () => {
                db.query(
                    "UPDATE users SET is_active = ? WHERE user_id = ?",
                    [isActive ? 1 : 0, userId],
                    (updateError, result) => {
                        if (updateError) {
                            console.error("Unable to update account access:", updateError);
                            return res.status(500).json({ message: "Unable to update account access." });
                        }

                        if (result.affectedRows === 0) {
                            return res.status(404).json({ message: "Account not found." });
                        }

                        return res.json({
                            message: `Account ${isActive ? "activated" : "deactivated"}.`,
                            user_id: userId,
                            is_active: isActive ? 1 : 0
                        });
                    }
                );
            };

            if (!isActive && rows[0].role === "ADMIN" && Number(rows[0].is_active) === 1) {
                db.query(
                    "SELECT COUNT(*) AS active_admins FROM users WHERE role = 'ADMIN' AND is_active = 1 AND user_id <> ?",
                    [userId],
                    (countError, counts) => {
                        if (countError) {
                            console.error("Unable to verify active administrators:", countError);
                            return res.status(500).json({ message: "Unable to update account access." });
                        }

                        if (counts[0].active_admins === 0) {
                            return res.status(409).json({ message: "The last active admin account cannot be deactivated." });
                        }

                        return updateAccess();
                    }
                );
                return;
            }

            return updateAccess();
        }
    );
});

router.post("/", verifyToken, requireAdmin, async (req, res) => {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const phone = String(req.body.phone || "").trim();
    const password = String(req.body.password || "");

    if (!name || !email || !password) {
        return res.status(400).json({
            message: "Name, email, and password are required"
        });
    }

    if (name.length > 100 || email.length > 100 || phone.length > 15) {
        return res.status(400).json({
            message: "One or more fields exceed the allowed length"
        });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({
            message: "Enter a valid email address"
        });
    }

    if (password.length < 8 || password.length > 72) {
        return res.status(400).json({
            message: "Password must be between 8 and 72 characters"
        });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = `
            INSERT INTO users (name, email, password, phone, role)
            VALUES (?, ?, ?, ?, 'ADMIN')
        `;

        db.query(sql, [name, email, hashedPassword, phone || null], (error, result) => {
            if (error) {
                if (error.code === "ER_DUP_ENTRY") {
                    return res.status(409).json({
                        message: "An account with this email already exists"
                    });
                }

                console.error("Admin registration error:", error);
                return res.status(500).json({
                    message: "Unable to create admin account"
                });
            }

            return res.status(201).json({
                message: "Admin account created successfully",
                user_id: result.insertId
            });
        });
    } catch (error) {
        console.error("Admin registration error:", error);
        return res.status(500).json({
            message: "Unable to create admin account"
        });
    }
});

module.exports = router;