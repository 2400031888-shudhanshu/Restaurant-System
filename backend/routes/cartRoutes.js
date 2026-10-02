const express = require("express");

const router = express.Router();
const db = require("../config/database");
const { verifyToken } = require("../middleware/authMiddleware");

const MAX_QUANTITY_PER_ITEM = 50;

function parsePositiveInt(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : null;
}

// =====================================
// GET USER CART
// =====================================
router.get("/", verifyToken, (req, res) => {
    const sql = `
        SELECT
            ci.cart_item_id,
            ci.cart_id,
            ci.food_id,
            ci.quantity,
            f.food_name,
            f.description,
            f.price,
            f.image_url,
            f.availability,
            (f.price * ci.quantity) AS subtotal
        FROM cart_items ci
        INNER JOIN cart c ON ci.cart_id = c.cart_id
        INNER JOIN food_items f ON ci.food_id = f.food_id
        WHERE c.user_id = ?
        ORDER BY ci.cart_item_id DESC
    `;

    db.query(sql, [req.user.userId], (error, results) => {
        if (error) {
            console.error("Cart error:", error);
            return res.status(500).json({ message: "Unable to load cart" });
        }

        const total = results.reduce((sum, item) => sum + Number(item.subtotal), 0);

        return res.json({ items: results, total: total.toFixed(2) });
    });
});

// =====================================
// ADD FOOD TO CART (or increase quantity)
// =====================================
router.post("/", verifyToken, async (req, res) => {
    const userId = req.user.userId;
    const foodId = parsePositiveInt(req.body.food_id);
    const quantity = req.body.quantity === undefined ? 1 : parsePositiveInt(req.body.quantity);

    if (!foodId) {
        return res.status(400).json({ message: "Food ID is required" });
    }

    if (!quantity || quantity > MAX_QUANTITY_PER_ITEM) {
        return res.status(400).json({
            message: `Quantity must be between 1 and ${MAX_QUANTITY_PER_ITEM}`
        });
    }

    const connection = await db.promise().getConnection();

    try {
        const [foods] = await connection.query(
            "SELECT availability FROM food_items WHERE food_id = ?",
            [foodId]
        );

        if (foods.length === 0) {
            return res.status(404).json({ message: "Food item not found" });
        }

        if (Number(foods[0].availability) !== 1) {
            return res.status(409).json({ message: "This item is currently not available" });
        }

        await connection.beginTransaction();

        // user_id is UNIQUE in cart, so this is safe even with parallel requests.
        await connection.query(
            "INSERT INTO cart (user_id) VALUES (?) ON DUPLICATE KEY UPDATE user_id = user_id",
            [userId]
        );
        const [carts] = await connection.query(
            "SELECT cart_id FROM cart WHERE user_id = ? FOR UPDATE",
            [userId]
        );
        const cartId = carts[0].cart_id;

        const [existing] = await connection.query(
            "SELECT cart_item_id, quantity FROM cart_items WHERE cart_id = ? AND food_id = ?",
            [cartId, foodId]
        );

        let newQuantity = quantity;
        let created = true;

        if (existing.length > 0) {
            created = false;
            newQuantity = Math.min(existing[0].quantity + quantity, MAX_QUANTITY_PER_ITEM);
            await connection.query(
                "UPDATE cart_items SET quantity = ? WHERE cart_item_id = ?",
                [newQuantity, existing[0].cart_item_id]
            );
        } else {
            await connection.query(
                "INSERT INTO cart_items (cart_id, food_id, quantity) VALUES (?, ?, ?)",
                [cartId, foodId, quantity]
            );
        }

        await connection.commit();

        return res.status(created ? 201 : 200).json({
            message: created ? "Food added to cart" : "Cart quantity updated",
            quantity: newQuantity
        });
    } catch (error) {
        try {
            await connection.rollback();
        } catch (rollbackError) {
            console.error("Rollback failed:", rollbackError);
        }
        console.error("Unable to add item to cart:", error);
        return res.status(500).json({ message: "Unable to add item to cart" });
    } finally {
        connection.release();
    }
});

// =====================================
// UPDATE CART ITEM QUANTITY
// =====================================
router.put("/:food_id", verifyToken, (req, res) => {
    const foodId = parsePositiveInt(req.params.food_id);
    const quantity = Number(req.body.quantity);

    if (!foodId) {
        return res.status(400).json({ message: "Invalid food ID" });
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY_PER_ITEM) {
        return res.status(400).json({
            message: `Quantity must be between 1 and ${MAX_QUANTITY_PER_ITEM}`
        });
    }

    const sql = `
        UPDATE cart_items ci
        INNER JOIN cart c ON ci.cart_id = c.cart_id
        SET ci.quantity = ?
        WHERE c.user_id = ? AND ci.food_id = ?
    `;

    db.query(sql, [quantity, req.user.userId, foodId], (error, result) => {
        if (error) {
            console.error("Unable to update cart:", error);
            return res.status(500).json({ message: "Unable to update cart" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Cart item not found" });
        }

        return res.json({ message: "Cart updated successfully" });
    });
});

// =====================================
// REMOVE FOOD FROM CART
// =====================================
router.delete("/:food_id", verifyToken, (req, res) => {
    const foodId = parsePositiveInt(req.params.food_id);

    if (!foodId) {
        return res.status(400).json({ message: "Invalid food ID" });
    }

    const sql = `
        DELETE ci
        FROM cart_items ci
        INNER JOIN cart c ON ci.cart_id = c.cart_id
        WHERE c.user_id = ? AND ci.food_id = ?
    `;

    db.query(sql, [req.user.userId, foodId], (error, result) => {
        if (error) {
            console.error("Unable to remove cart item:", error);
            return res.status(500).json({ message: "Unable to remove cart item" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Cart item not found" });
        }

        return res.json({ message: "Item removed from cart" });
    });
});

module.exports = router;
