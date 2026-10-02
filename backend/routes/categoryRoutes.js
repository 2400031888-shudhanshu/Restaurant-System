const express = require("express");

const router = express.Router();

const db = require("../config/database");


// =====================================
// GET ALL CATEGORIES
// =====================================

router.get("/", (req, res) => {

    const sql = `
        SELECT
            category_id,
            category_name
        FROM categories
        ORDER BY category_name ASC
    `;


    db.query(sql, (err, results) => {

        if (err) {

            console.error(
                "Category error:",
                err
            );

            return res.status(500).json({

                message:
                    "Unable to fetch categories"

            });

        }


        res.json(results);

    });

});


module.exports = router;