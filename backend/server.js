require("dotenv").config();

const express = require("express");
const path = require("path");

const db = require("./config/database");
const { getJwtSecret } = require("./config/env");

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

// Basic security headers
app.use((req, res, next) => {
    res.set({
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "Referrer-Policy": "strict-origin-when-cross-origin"
    });
    next();
});

// ---------- API ----------
app.get("/api/health", (req, res) => {
    db.query("SELECT 1", error => {
        if (error) {
            return res.status(503).json({ status: "error", database: "unreachable" });
        }
        return res.json({ status: "ok", database: "connected" });
    });
});

app.use("/api/foods", require("./routes/foodRoutes"));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/cart", require("./routes/cartRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/admin/users", require("./routes/adminUserRoutes"));
app.use("/api/admin/staff", require("./routes/staffRoutes"));
app.use("/api/admin/foods", require("./routes/foodAdminRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/feedback", require("./routes/feedbackRoutes"));

// Unknown API routes return JSON instead of an HTML page.
app.use("/api", (req, res) => {
    res.status(404).json({ message: "API route not found" });
});

// ---------- Frontend ----------
const frontendPath = path.resolve(__dirname, "../frontend");

app.use(express.static(frontendPath, { dotfiles: "ignore" }));

app.get("/", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
});

// ---------- Error handling ----------
app.use((error, req, res, next) => {
    if (error.type === "entity.parse.failed") {
        return res.status(400).json({ message: "Invalid JSON in request body" });
    }

    if (error.type === "entity.too.large") {
        return res.status(413).json({ message: "Request body is too large" });
    }

    console.error("Unhandled error:", error);

    if (res.headersSent) {
        return next(error);
    }

    return res.status(500).json({ message: "Something went wrong on the server" });
});

async function start() {
    getJwtSecret(); // refuse to start with a missing/weak secret

    try {
        await db.checkConnection();
        console.log("✅ MySQL connected and schema found");
    } catch (error) {
        console.error("❌ Database problem:", error.message);
        process.exit(1);
    }

    const port = Number(process.env.PORT) || 5000;
    const server = app.listen(port, () => {
        console.log(`🚀 Server running on http://localhost:${port}`);
    });

    server.on("error", error => {
        console.error(
            error.code === "EADDRINUSE"
                ? `❌ Port ${port} is already in use. Set a different PORT in backend/.env.`
                : `❌ Server error: ${error.message}`
        );
        process.exit(1);
    });

    const shutdown = () => {
        server.close(() => db.end(() => process.exit(0)));
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

if (require.main === module) {
    start().catch(error => {
        console.error("❌ Failed to start:", error.message);
        process.exit(1);
    });
}

module.exports = app;
