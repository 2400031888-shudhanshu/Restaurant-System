const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const db = require("../config/database");
const { getJwtSecret } = require("../config/env");
const { verifyToken } = require("../middleware/authMiddleware");
const { rateLimit } = require("../middleware/rateLimit");

const router = express.Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: "Too many attempts. Please wait a few minutes and try again."
});

router.get("/me", verifyToken, (req, res) => {
    db.query(
        "SELECT user_id, name, email, phone, role FROM users WHERE user_id = ?",
        [req.user.userId],
        (error, rows) => {
            if (error || !rows.length) {
                return res.status(500).json({ message: "Unable to load your profile." });
            }
            return res.json(rows[0]);
        }
    );
});

// =============================
// REGISTER (customers only)
// =============================
router.post("/register", authLimiter, async (req, res) => {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const phone = String(req.body.phone || "").trim();
    const password = String(req.body.password || "");

    if (!name || !email || !password) {
        return res.status(400).json({ message: "Name, email and password are required" });
    }

    if (name.length > 100 || email.length > 100 || phone.length > 15) {
        return res.status(400).json({ message: "One or more fields exceed the allowed length." });
    }

    if (!EMAIL_PATTERN.test(email)) {
        return res.status(400).json({ message: "Enter a valid email address" });
    }

    if (password.length < 8 || password.length > 72) {
        return res.status(400).json({ message: "Password must be between 8 and 72 characters" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.query(
            `INSERT INTO users (name, email, password, phone, role)
             VALUES (?, ?, ?, ?, 'CUSTOMER')`,
            [name, email, hashedPassword, phone || null],
            (error, result) => {
                if (error?.code === "ER_DUP_ENTRY") {
                    return res.status(409).json({ message: "Email already registered" });
                }

                if (error) {
                    console.error("Registration error:", error);
                    return res.status(500).json({ message: "Registration failed" });
                }

                return res.status(201).json({
                    message: "Registration successful",
                    user_id: result.insertId
                });
            }
        );
    } catch (error) {
        console.error("Server error:", error);
        return res.status(500).json({ message: "Server error" });
    }
});

// =============================
// LOGIN
// =============================
router.post("/login", authLimiter, (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }

    db.query(
        "SELECT * FROM users WHERE email = ? AND is_active = 1",
        [email],
        (error, results) => {
            if (error) {
                console.error("Database error:", error);
                return res.status(500).json({ message: "Database error" });
            }

            if (results.length === 0) {
                return res.status(401).json({ message: "Invalid email or password" });
            }

            const user = results[0];

            bcrypt.compare(password, user.password).then(passwordMatches => {
                if (!passwordMatches) {
                    return res.status(401).json({ message: "Invalid email or password" });
                }

                db.query(
                    "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = ?",
                    [user.user_id],
                    updateError => {
                        if (updateError) {
                            console.error("Unable to record login time:", updateError);
                        }

                        const token = jwt.sign(
                            { userId: user.user_id, email: user.email, role: user.role },
                            getJwtSecret(),
                            { expiresIn: "1d" }
                        );

                        return res.json({
                            message: "Login successful",
                            token,
                            user: {
                                user_id: user.user_id,
                                name: user.name,
                                email: user.email,
                                phone: user.phone,
                                role: user.role
                            }
                        });
                    }
                );
            }).catch(compareError => {
                console.error("Password verification failed:", compareError);
                return res.status(500).json({ message: "Unable to verify login." });
            });
        }
    );
});

module.exports = router;
