const express = require("express");
const router = express.Router();

const db = require("../config/database");

// GET all food items
router.get("/", (req, res) => {
    const sql = `
        SELECT
            f.food_id,
            f.food_name,
            f.description,
            f.price,
            f.image_url,
            f.availability,
            c.category_name
        FROM food_items f
        JOIN categories c
            ON f.category_id = c.category_id
        ORDER BY f.food_id;
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error fetching food items:", err);
            return res.status(500).json({
                message: "Failed to fetch food items"
            });
        }

        res.json(results);
    });
});

module.exports = router;