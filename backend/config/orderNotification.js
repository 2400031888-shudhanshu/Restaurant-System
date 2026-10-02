const nodemailer = require("nodemailer");

function buildTransporter() {
    const host = process.env.SMTP_HOST;
    const username = process.env.SMTP_USER;
    const password = process.env.SMTP_PASSWORD;

    if (!host || !username || !password) {
        return null;
    }

    const port = Number(process.env.SMTP_PORT || 587);

    return nodemailer.createTransport({
        host,
        port,
        secure: process.env.SMTP_SECURE === "true" || port === 465,
        auth: { user: username, pass: password },
        connectionTimeout: 10000,
        socketTimeout: 15000
    });
}

// Strip line breaks so user input can never inject extra mail headers.
function singleLine(value) {
    return String(value ?? "").replace(/[\r\n]+/g, " ").trim();
}

async function sendOrderAlert(order) {
    const transporter = buildTransporter();

    if (!transporter) {
        console.warn("Order email alert skipped: configure SMTP_HOST, SMTP_USER, and SMTP_PASSWORD.");
        return false;
    }

    const recipient = process.env.ORDER_ALERT_EMAIL || process.env.FEEDBACK_EMAIL || process.env.SMTP_USER;

    const itemSummary = order.items
        .map(item => `- ${item.food_name} x ${item.quantity}: INR ${(Number(item.price) * Number(item.quantity)).toFixed(2)}`)
        .join("\n");

    await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: recipient,
        replyTo: singleLine(order.customerEmail) || undefined,
        subject: `New restaurant order #${order.orderId}`,
        text: [
            "A new order was placed.",
            `Order: #${order.orderId}`,
            `Customer: ${order.customerEmail || "Not provided"}`,
            `Total: INR ${Number(order.totalAmount).toFixed(2)}`,
            "",
            "Items:",
            itemSummary,
            "",
            `Delivery address: ${order.deliveryAddress}`
        ].join("\n")
    });

    return true;
}

async function sendFeedbackEmail(feedback) {
    const transporter = buildTransporter();

    if (!transporter) {
        console.warn("Feedback email skipped: configure SMTP_HOST, SMTP_USER, and SMTP_PASSWORD.");
        return false;
    }

    await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: process.env.FEEDBACK_EMAIL || process.env.ORDER_ALERT_EMAIL || process.env.SMTP_USER,
        replyTo: singleLine(feedback.email),
        subject: `Restaurant website feedback from ${singleLine(feedback.name)}`,
        text: [
            `Name: ${feedback.name}`,
            `Email: ${feedback.email}`,
            "",
            "Feedback:",
            feedback.message
        ].join("\n")
    });

    return true;
}

module.exports = { sendOrderAlert, sendFeedbackEmail };
