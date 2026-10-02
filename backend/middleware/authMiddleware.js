const jwt = require("jsonwebtoken");
const db = require("../config/database");
const { getJwtSecret } = require("../config/env");


// =====================================
// VERIFY JWT TOKEN
// =====================================

function verifyToken(req, res, next) {

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;

    if (!token) {
        return res.status(401).json({
            message: "Access denied. Login required."
        });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, getJwtSecret());
    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired token."
        });
    }

    db.query(
        "SELECT role, is_active FROM users WHERE user_id = ?",
        [decoded.userId],
        (error, rows) => {
            if (error) {
                console.error("Authentication lookup failed:", error);
                return res.status(500).json({
                    message: "Unable to verify account access."
                });
            }

            if (!rows.length || Number(rows[0].is_active) !== 1) {
                return res.status(401).json({
                    message: "This account is inactive or no longer exists."
                });
            }

            req.user = {
                ...decoded,
                role: rows[0].role
            };
            return next();
        }
    );
}


// =====================================
// ADMIN ONLY
// =====================================

function requireAdmin(req, res, next) {

    if (!req.user) {

        return res.status(401).json({
            message: "Authentication required."
        });

    }


    if (req.user.role !== "ADMIN") {

        return res.status(403).json({
            message: "Admin access required."
        });

    }


    next();

}

function requireStaff(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required."
        });
    }

    if (!['ADMIN', 'STAFF', 'DELIVERY'].includes(req.user.role)) {
        return res.status(403).json({
            message: "Staff access required."
        });
    }

    return next();
}


module.exports = {
    verifyToken,
    requireAdmin,
    requireStaff
};