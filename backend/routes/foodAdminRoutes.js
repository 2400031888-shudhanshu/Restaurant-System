const express = require("express");

const router = express.Router();
const db = require("../config/database");
const { verifyToken, requireAdmin } = require("../middleware/authMiddleware");

router.use(verifyToken, requireAdmin);

// Validates and normalises the body of create/update requests.
function parseFoodBody(body) {
    const categoryId = Number(body.category_id);
    const foodName = String(body.food_name || "").trim();
    const description = String(body.description || "").trim();
    const imageUrl = String(body.image_url || "").trim();
    const price = Number(body.price);
    const availability =
        body.availability === undefined || body.availability === null || body.availability === ""
            ? 1
            : (Number(body.availability) ? 1 : 0);

    if (!Number.isInteger(categoryId) || categoryId < 1) {
        return { error: "Choose a category" };
    }

    if (!foodName || foodName.length > 150) {
        return { error: "Food name is required (150 characters max)" };
    }

    if (!Number.isFinite(price) || price < 0 || price > 99999999.99) {
        return { error: "Enter a valid price" };
    }

    if (imageUrl.length > 500) {
        return { error: "Image URL is too long (500 characters max)" };
    }

    if (imageUrl && !/^(https?:\/\/|\/(?!\/)|[a-z0-9][^:]*$)/i.test(imageUrl)) {
        return { error: "Image URL must start with http:// or https://, or be a local file path" };
    }

    return {
        value: {
            categoryId,
            foodName,
            description: description || null,
            price: price.toFixed(2),
            imageUrl: imageUrl || null,
            availability
        }
    };
}

function foreignKeyMessage(error) {
    return error && error.code === "ER_NO_REFERENCED_ROW_2" ? "Selected category does not exist" : null;
}

// =====================================
// GET ALL FOOD ITEMS
// =====================================
router.get("/", (req, res) => {
    const sql = `
        SELECT
            f.food_id,
            f.category_id,
            c.category_name,
            f.food_name,
            f.description,
            f.price,
            f.image_url,
            f.availability,
            f.created_at
        FROM food_items f
        LEFT JOIN categories c ON f.category_id = c.category_id
        ORDER BY f.food_id DESC
    `;

    db.query(sql, (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ message: "Unable to fetch food items" });
        }

        return res.json(results);
    });
});

// =====================================
// ADD FOOD ITEM
// =====================================
router.post("/", (req, res) => {
    const parsed = parseFoodBody(req.body);

    if (parsed.error) {
        return res.status(400).json({ message: parsed.error });
    }

    const food = parsed.value;

    db.query(
        `INSERT INTO food_items (category_id, food_name, description, price, image_url, availability)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [food.categoryId, food.foodName, food.description, food.price, food.imageUrl, food.availability],
        (error, result) => {
            if (error) {
                const message = foreignKeyMessage(error);
                if (message) {
                    return res.status(400).json({ message });
                }
                console.error(error);
                return res.status(500).json({ message: "Unable to add food item" });
            }

            return res.status(201).json({
                message: "Food item added successfully",
                food_id: result.insertId
            });
        }
    );
});

// =====================================
// UPDATE AVAILABILITY
// (declared before "/:food_id" routes for clarity)
// =====================================
router.put("/:food_id/availability", (req, res) => {
    const foodId = Number(req.params.food_id);

    if (!Number.isInteger(foodId) || foodId < 1) {
        return res.status(400).json({ message: "Invalid food ID" });
    }

    db.query(
        "UPDATE food_items SET availability = ? WHERE food_id = ?",
        [req.body.availability ? 1 : 0, foodId],
        (error, result) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ message: "Unable to update availability" });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Food item not found" });
            }

            return res.json({ message: "Availability updated successfully" });
        }
    );
});

// =====================================
// UPDATE FOOD ITEM
// =====================================
router.put("/:food_id", (req, res) => {
    const foodId = Number(req.params.food_id);

    if (!Number.isInteger(foodId) || foodId < 1) {
        return res.status(400).json({ message: "Invalid food ID" });
    }

    const parsed = parseFoodBody(req.body);

    if (parsed.error) {
        return res.status(400).json({ message: parsed.error });
    }

    const food = parsed.value;

    db.query(
        `UPDATE food_items
         SET category_id = ?, food_name = ?, description = ?, price = ?, image_url = ?, availability = ?
         WHERE food_id = ?`,
        [food.categoryId, food.foodName, food.description, food.price, food.imageUrl, food.availability, foodId],
        (error, result) => {
            if (error) {
                const message = foreignKeyMessage(error);
                if (message) {
                    return res.status(400).json({ message });
                }
                console.error(error);
                return res.status(500).json({ message: "Unable to update food item" });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Food item not found" });
            }

            return res.json({ message: "Food item updated successfully" });
        }
    );
});

// =====================================
// DELETE FOOD ITEM
// Past orders keep their line items: order_items.food_id becomes NULL and the
// name/price were already copied into order_items when the order was placed.
// =====================================
router.delete("/:food_id", (req, res) => {
    const foodId = Number(req.params.food_id);

    if (!Number.isInteger(foodId) || foodId < 1) {
        return res.status(400).json({ message: "Invalid food ID" });
    }

    db.query("DELETE FROM food_items WHERE food_id = ?", [foodId], (error, result) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ message: "Unable to delete food item" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Food item not found" });
        }

        return res.json({ message: "Food item deleted successfully" });
    });
});

module.exports = router;
