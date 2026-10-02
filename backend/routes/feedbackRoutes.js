const express = require("express");

const router = express.Router();
const db = require("../config/database");
const { sendFeedbackEmail } = require("../config/orderNotification");

router.post("/", (req, res) => {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const message = String(req.body.message || "").trim();

    if (!name || !email || !message) {
        return res.status(400).json({ message: "Name, email, and feedback are required." });
    }

    if (name.length > 100 || email.length > 100 || message.length > 2000) {
        return res.status(400).json({ message: "Feedback exceeds the allowed length." });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "Enter a valid email address." });
    }

    db.query(
        "INSERT INTO customer_feedback (name, email, message) VALUES (?, ?, ?)",
        [name, email, message],
        async error => {
            if (error) {
                console.error("Unable to save customer feedback:", error);
                return res.status(500).json({ message: "Unable to save your feedback right now." });
            }

            try {
                const emailSent = await sendFeedbackEmail({ name, email, message });
                return res.status(201).json({
                    email_sent: emailSent,
                    message: emailSent
                        ? "Thank you. Your feedback was sent to the restaurant."
                        : "Your feedback was saved, but email is not configured. Please contact the restaurant directly."
                });
            } catch (emailError) {
                console.error("Unable to email customer feedback:", emailError.message);
                return res.status(201).json({
                    email_sent: false,
                    message: "Your feedback was saved, but the email could not be sent. Please contact the restaurant directly."
                });
            }
        }
    );
});

module.exports = router;