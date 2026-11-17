
const express = require("express");
const router = express.Router();

const { pool } = require("../config/db");
const { requireLogin, requireAdmin } = require("../middleware/auth");

// Validate database ID
function validId(value) {
    return Number.isInteger(Number(value)) && Number(value) > 0;
}

// Handle duplicate names
function handleError(res, error, message) {
    console.error(message, error.message);

    if (error.code === "23505") {
        return res.status(409).json({
            success: false,
            message: "This name already exists."
        });
    }

    res.status(500).json({
        success: false,
        message
    });
}

// ==========================================
// GET ALL CATEGORIES AND SUBCATEGORIES
// ADMIN AND STAFF
// ==========================================

router.get("/", requireLogin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                c.id,
                c.name,
                c.created_at,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', s.id,
                            'name', s.name
                        )
                    ) FILTER (WHERE s.id IS NOT NULL),
                    '[]'
                ) AS subcategories
            FROM categories c
            LEFT JOIN subcategories s
                ON s.category_id = c.id
            GROUP BY c.id
            ORDER BY c.name ASC
        `);

        res.json({
            success: true,
            categories: result.rows
        });

    } catch (error) {
        handleError(res, error, "Could not fetch categories.");
    }
});

// ==========================================
// CREATE CATEGORY
// ADMIN ONLY
// ==========================================

router.post("/", requireAdmin, async (req, res) => {
    try {
        const name = req.body.name?.trim();

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Category name is required."
            });
        }

        if (name.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Category name cannot exceed 100 characters."
            });
        }

        const result = await pool.query(
            `INSERT INTO categories (name)
             VALUES ($1)
             RETURNING *`,
            [name]
        );

        res.status(201).json({
            success: true,
            message: "Category created successfully.",
            category: result.rows[0]
        });

    } catch (error) {
        handleError(res, error, "Could not create category.");
    }
});

// ==========================================
// UPDATE CATEGORY
// ADMIN ONLY
// ==========================================

router.put("/:id", requireAdmin, async (req, res) => {
    try {
        if (!validId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid category ID."
            });
        }

        const name = req.body.name?.trim();

        if (!name || name.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid category name."
            });
        }

        const result = await pool.query(
            `UPDATE categories
             SET name = $1
             WHERE id = $2
             RETURNING *`,
            [name, req.params.id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Category not found."
            });
        }

        res.json({
            success: true,
            message: "Category updated successfully.",
            category: result.rows[0]
        });

    } catch (error) {
        handleError(res, error, "Could not update category.");
    }
});

// ==========================================
// DELETE CATEGORY
// ADMIN ONLY
// ==========================================

router.delete("/:id", requireAdmin, async (req, res) => {
    const client = await pool.connect();

    try {
        if (!validId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid category ID."
            });
        }

        await client.query("BEGIN");

        const category = await client.query(
            `SELECT id FROM categories
             WHERE id = $1
             FOR UPDATE`,
            [req.params.id]
        );

        if (category.rowCount === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Category not found."
            });
        }

        const products = await client.query(
            `SELECT id FROM products
             WHERE category_id = $1
             LIMIT 1`,
            [req.params.id]
        );

        const subcategories = await client.query(
            `SELECT id FROM subcategories
             WHERE category_id = $1
             LIMIT 1`,
            [req.params.id]
        );

        if (products.rowCount > 0 || subcategories.rowCount > 0) {
            await client.query("ROLLBACK");

            return res.status(409).json({
                success: false,
                message: "This category contains products or subcategories. Remove or reassign them before deleting."
            });
        }

        await client.query(
            "DELETE FROM categories WHERE id = $1",
            [req.params.id]
        );

        await client.query("COMMIT");

        res.json({
            success: true,
            message: "Category deleted successfully."
        });

    } catch (error) {
        await client.query("ROLLBACK");
        handleError(res, error, "Could not delete category.");

    } finally {
        client.release();
    }
});

// ==========================================
// GET SUBCATEGORIES OF A CATEGORY
// ADMIN AND STAFF
// ==========================================

router.get("/:categoryId/subcategories", requireLogin, async (req, res) => {
    try {
        if (!validId(req.params.categoryId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid category ID."
            });
        }

        const result = await pool.query(
            `SELECT *
             FROM subcategories
             WHERE category_id = $1
             ORDER BY name ASC`,
            [req.params.categoryId]
        );

        res.json({
            success: true,
            subcategories: result.rows
        });

    } catch (error) {
        handleError(res, error, "Could not fetch subcategories.");
    }
});

// ==========================================
// CREATE SUBCATEGORY
// ADMIN ONLY
// ==========================================

router.post("/:categoryId/subcategories", requireAdmin, async (req, res) => {
    try {
        if (!validId(req.params.categoryId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid category ID."
            });
        }

        const name = req.body.name?.trim();

        if (!name || name.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid subcategory name."
            });
        }

        const category = await pool.query(
            "SELECT id FROM categories WHERE id = $1",
            [req.params.categoryId]
        );

        if (category.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Category not found."
            });
        }

        const result = await pool.query(
            `INSERT INTO subcategories (category_id, name)
             VALUES ($1, $2)
             RETURNING *`,
            [req.params.categoryId, name]
        );

        res.status(201).json({
            success: true,
            message: "Subcategory created successfully.",
            subcategory: result.rows[0]
        });

    } catch (error) {
        handleError(res, error, "Could not create subcategory.");
    }
});

// ==========================================
// UPDATE SUBCATEGORY
// ADMIN ONLY
// ==========================================

router.put("/subcategories/:id", requireAdmin, async (req, res) => {
    try {
        if (!validId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid subcategory ID."
            });
        }

        const name = req.body.name?.trim();

        if (!name || name.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid subcategory name."
            });
        }

        const result = await pool.query(
            `UPDATE subcategories
             SET name = $1
             WHERE id = $2
             RETURNING *`,
            [name, req.params.id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Subcategory not found."
            });
        }

        res.json({
            success: true,
            message: "Subcategory updated successfully.",
            subcategory: result.rows[0]
        });

    } catch (error) {
        handleError(res, error, "Could not update subcategory.");
    }
});

// ==========================================
// DELETE SUBCATEGORY
// ADMIN ONLY
// ==========================================

router.delete("/subcategories/:id", requireAdmin, async (req, res) => {
    try {
        if (!validId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid subcategory ID."
            });
        }

        const products = await pool.query(
            `SELECT id FROM products
             WHERE subcategory_id = $1
             LIMIT 1`,
            [req.params.id]
        );

        if (products.rowCount > 0) {
            return res.status(409).json({
                success: false,
                message: "This subcategory contains products. Reassign them before deleting."
            });
        }

        const result = await pool.query(
            `DELETE FROM subcategories
             WHERE id = $1
             RETURNING id`,
            [req.params.id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Subcategory not found."
            });
        }

        res.json({
            success: true,
            message: "Subcategory deleted successfully."
        });

    } catch (error) {
        handleError(res, error, "Could not delete subcategory.");
    }
});

module.exports = router;
