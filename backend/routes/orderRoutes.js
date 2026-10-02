const express = require("express");

const router = express.Router();
const db = require("../config/database");

const {
    verifyToken,
    requireAdmin,
    requireStaff
} = require("../middleware/authMiddleware");
const { sendOrderAlert } = require("../config/orderNotification");

const ORDER_STATUSES = [
    "PENDING",
    "CONFIRMED",
    "PREPARING",
    "READY",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED"
];

const ORDER_SELECT = `
    SELECT
        o.order_id,
        o.user_id,
        o.total_amount,
        o.order_status,
        o.delivery_address,
        o.order_date,
        p.payment_method,
        p.payment_status,
        p.transaction_id
    FROM orders o
    LEFT JOIN payments p ON p.order_id = o.order_id
`;

function attachOrderItems(orders, callback) {
    if (orders.length === 0) {
        return callback(null, orders);
    }

    const orderIds = orders.map(order => order.order_id);
    const sql = `
        SELECT
            oi.order_id,
            oi.food_id,
            COALESCE(oi.food_name, f.food_name, 'Unavailable item') AS food_name,
            oi.quantity,
            oi.price
        FROM order_items oi
        LEFT JOIN food_items f ON f.food_id = oi.food_id
        WHERE oi.order_id IN (?)
        ORDER BY oi.order_id, oi.order_item_id
    `;

    db.query(sql, [orderIds], (error, items) => {
        if (error) {
            return callback(error);
        }

        const itemsByOrder = new Map(orderIds.map(orderId => [orderId, []]));
        items.forEach(item => {
            item.subtotal = Number(item.price) * Number(item.quantity);
            itemsByOrder.get(item.order_id).push(item);
        });

        orders.forEach(order => {
            order.items = itemsByOrder.get(order.order_id);
        });

        return callback(null, orders);
    });
}

function sendOrders(res, errorMessage) {
    return (error, orders) => {
        if (error) {
            console.error(errorMessage, error);
            return res.status(500).json({ message: errorMessage });
        }

        return attachOrderItems(orders, (itemsError, withItems) => {
            if (itemsError) {
                console.error("Unable to fetch order items:", itemsError);
                return res.status(500).json({ message: "Unable to fetch order items" });
            }

            return res.json(withItems);
        });
    };
}

// =====================================
// PLACE ORDER (single database transaction)
// =====================================
router.post("/place", verifyToken, async (req, res) => {
    const userId = req.user.userId;
    const deliveryAddress = String(req.body.delivery_address || "").trim();
    const paymentMethod = String(req.body.payment_method || "").trim().toUpperCase();
    const transactionId = String(req.body.transaction_id || "").trim();

    if (!deliveryAddress) {
        return res.status(400).json({ message: "Delivery address is required" });
    }

    if (deliveryAddress.length > 1000) {
        return res.status(400).json({ message: "Delivery address is too long." });
    }

    if (!["COD", "UPI"].includes(paymentMethod)) {
        return res.status(400).json({ message: "Choose COD or UPI payment." });
    }

    if (transactionId.length > 100) {
        return res.status(400).json({ message: "UPI reference must be 100 characters or fewer." });
    }

    const connection = await db.promise().getConnection();

    try {
        await connection.beginTransaction();

        const [carts] = await connection.query(
            "SELECT cart_id FROM cart WHERE user_id = ? FOR UPDATE",
            [userId]
        );

        if (carts.length === 0) {
            await connection.rollback();
            return res.status(400).json({ message: "Cart not found" });
        }

        const cartId = carts[0].cart_id;

        const [items] = await connection.query(
            `SELECT ci.food_id, ci.quantity, f.food_name, f.price, f.availability
             FROM cart_items ci
             JOIN food_items f ON f.food_id = ci.food_id
             WHERE ci.cart_id = ?`,
            [cartId]
        );

        if (items.length === 0) {
            await connection.rollback();
            return res.status(400).json({ message: "Your cart is empty" });
        }

        const unavailable = items.filter(item => Number(item.availability) !== 1);
        if (unavailable.length > 0) {
            await connection.rollback();
            return res.status(409).json({
                message: `No longer available: ${unavailable.map(item => item.food_name).join(", ")}. Remove them from your cart to continue.`
            });
        }

        const totalAmount = items.reduce(
            (sum, item) => sum + Number(item.price) * Number(item.quantity),
            0
        );

        const [orderResult] = await connection.query(
            "INSERT INTO orders (user_id, total_amount, delivery_address) VALUES (?, ?, ?)",
            [userId, totalAmount.toFixed(2), deliveryAddress]
        );
        const orderId = orderResult.insertId;

        await connection.query(
            `INSERT INTO payments (order_id, payment_method, payment_status, transaction_id)
             VALUES (?, ?, 'PENDING', ?)`,
            [orderId, paymentMethod, transactionId || null]
        );

        await connection.query(
            "INSERT INTO order_items (order_id, food_id, food_name, quantity, price) VALUES ?",
            [items.map(item => [orderId, item.food_id, item.food_name, item.quantity, item.price])]
        );

        await connection.query("DELETE FROM cart_items WHERE cart_id = ?", [cartId]);

        await connection.commit();

        sendOrderAlert({
            orderId,
            customerEmail: req.user.email,
            deliveryAddress,
            items,
            totalAmount
        }).catch(emailError => {
            console.error("Order email alert failed:", emailError.message);
        });

        return res.status(201).json({
            message: "Order placed successfully",
            order_id: orderId,
            total_amount: Number(totalAmount.toFixed(2)),
            payment_method: paymentMethod,
            payment_status: "PENDING"
        });
    } catch (error) {
        try {
            await connection.rollback();
        } catch (rollbackError) {
            console.error("Rollback failed:", rollbackError);
        }
        console.error("Unable to place order:", error);
        return res.status(500).json({ message: "Unable to place order" });
    } finally {
        connection.release();
    }
});

// =====================================
// PUBLIC PAYMENT SETTINGS
// =====================================
router.get("/payment-options", (req, res) => {
    return res.json({
        upi_vpa: process.env.UPI_VPA || "",
        upi_payee_name: process.env.UPI_PAYEE_NAME || "Restaurant"
    });
});

// =====================================
// ADMIN - ORDERS OF ONE USER
// =====================================
router.get("/user/:user_id", verifyToken, requireAdmin, (req, res) => {
    const userId = Number(req.params.user_id);

    if (!Number.isInteger(userId) || userId < 1) {
        return res.status(400).json({ message: "Invalid user ID." });
    }

    db.query(
        `${ORDER_SELECT} WHERE o.user_id = ? ORDER BY o.order_date DESC, o.order_id DESC`,
        [userId],
        sendOrders(res, "Unable to fetch orders")
    );
});

// =====================================
// LOGGED-IN USER ORDERS
// =====================================
router.get("/my-orders", verifyToken, (req, res) => {
    db.query(
        `${ORDER_SELECT} WHERE o.user_id = ? ORDER BY o.order_date DESC, o.order_id DESC`,
        [req.user.userId],
        sendOrders(res, "Unable to fetch your orders")
    );
});

// =====================================
// STAFF - ALL ORDERS
// =====================================
router.get("/admin/all", verifyToken, requireStaff, (req, res) => {
    const sql = `
        SELECT
            o.order_id,
            o.user_id,
            u.name AS customer_name,
            u.email AS customer_email,
            u.phone AS customer_phone,
            o.total_amount,
            o.order_status,
            o.delivery_address,
            o.order_date,
            p.payment_method,
            p.payment_status,
            p.transaction_id
        FROM orders o
        JOIN users u ON u.user_id = o.user_id
        LEFT JOIN payments p ON p.order_id = o.order_id
        ORDER BY o.order_date DESC, o.order_id DESC
    `;

    db.query(sql, sendOrders(res, "Unable to fetch all orders"));
});

// =====================================
// STAFF - UPDATE ORDER STATUS
// =====================================
router.put("/:order_id/status", verifyToken, requireStaff, (req, res) => {
    const orderId = Number(req.params.order_id);
    const orderStatus = req.body.order_status;

    if (!Number.isInteger(orderId) || orderId < 1) {
        return res.status(400).json({ message: "Invalid order ID." });
    }

    if (!ORDER_STATUSES.includes(orderStatus)) {
        return res.status(400).json({ message: "Invalid order status" });
    }

    const isDelivery = req.user.role === "DELIVERY";

    if (isDelivery && !["OUT_FOR_DELIVERY", "DELIVERED"].includes(orderStatus)) {
        return res.status(403).json({ message: "Delivery accounts can only update delivery progress." });
    }

    const sql = isDelivery
        ? `UPDATE orders
           SET order_status = ?
           WHERE order_id = ?
             AND ((order_status = 'READY' AND ? = 'OUT_FOR_DELIVERY')
               OR (order_status = 'OUT_FOR_DELIVERY' AND ? = 'DELIVERED'))`
        : "UPDATE orders SET order_status = ? WHERE order_id = ?";

    const params = isDelivery
        ? [orderStatus, orderId, orderStatus, orderStatus]
        : [orderStatus, orderId];

    db.query(sql, params, (error, result) => {
        if (error) {
            console.error("Unable to update order status:", error);
            return res.status(500).json({ message: "Unable to update order status" });
        }

        if (result.affectedRows === 0) {
            return res.status(isDelivery ? 409 : 404).json({
                message: isDelivery
                    ? "Order must be READY before pickup or OUT_FOR_DELIVERY before delivery completion."
                    : "Order not found"
            });
        }

        return res.json({ message: "Order status updated successfully" });
    });
});

// =====================================
// STAFF - CONFIRM PAYMENT
// (this was accidentally nested inside the status handler before)
// =====================================
router.put("/:order_id/payment/confirm", verifyToken, requireStaff, (req, res) => {
    const orderId = Number(req.params.order_id);

    if (!Number.isInteger(orderId) || orderId < 1) {
        return res.status(400).json({ message: "Invalid order ID." });
    }

    const isDelivery = req.user.role === "DELIVERY";
    const sql = isDelivery
        ? `UPDATE payments p
           JOIN orders o ON o.order_id = p.order_id
           SET p.payment_status = 'PAID', p.payment_date = CURRENT_TIMESTAMP
           WHERE p.order_id = ? AND p.payment_status = 'PENDING'
             AND p.payment_method = 'COD' AND o.order_status = 'DELIVERED'`
        : `UPDATE payments
           SET payment_status = 'PAID', payment_date = CURRENT_TIMESTAMP
           WHERE order_id = ? AND payment_status = 'PENDING'`;

    db.query(sql, [orderId], (error, result) => {
        if (error) {
            console.error("Unable to confirm payment:", error);
            return res.status(500).json({ message: "Unable to confirm payment." });
        }

        if (result.affectedRows === 0) {
            return res.status(409).json({
                message: isDelivery
                    ? "Delivery accounts can confirm cash only after the order is marked delivered."
                    : "No pending payment was found for this order."
            });
        }

        return res.json({ message: "Payment marked as paid." });
    });
});

module.exports = router;
