
const express = require("express");
const router = express.Router();

const { pool } = require("../config/db");
const { requireLogin, requireAdmin } = require("../middleware/auth");

// GET ALL PRODUCTS
router.get("/", requireLogin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                p.*,
                c.name AS category_name,
                s.name AS subcategory_name
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN subcategories s ON s.id = p.subcategory_id
            WHERE p.is_active = TRUE
            ORDER BY p.name ASC
        `);

        res.json({
            success: true,
            products: result.rows
        });
    } catch (error) {
        console.error("Products error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to load products."
        });
    }
});

// ADD PRODUCT WITH OPENING STOCK
router.post("/", requireLogin, async (req, res) => {
    const {
        name,
        category_id,
        subcategory_id,
        base_unit,
        opening_stock,
        minimum_stock,
        purchase_price,
        selling_price
    } = req.body;

    const stock = Number(opening_stock ?? 0);
    const minimum = Number(minimum_stock ?? 0);
    const purchase = Number(purchase_price ?? 0);
    const selling = Number(selling_price ?? 0);

    if (!name || !String(name).trim() || !base_unit) {
        return res.status(400).json({
            success: false,
            message: "Product name and unit are required."
        });
    }

    if (
        !Number.isFinite(stock) || stock < 0 ||
        !Number.isFinite(minimum) || minimum < 0 ||
        !Number.isFinite(purchase) || purchase < 0 ||
        !Number.isFinite(selling) || selling < 0
    ) {
        return res.status(400).json({
            success: false,
            message: "Please enter valid non-negative numbers."
        });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        if (subcategory_id) {
            const check = await client.query(
                `SELECT id FROM subcategories
                 WHERE id = $1 AND category_id = $2`,
                [subcategory_id, category_id]
            );

            if (check.rows.length === 0) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    success: false,
                    message: "Selected subcategory does not belong to this category."
                });
            }
        }

        const result = await client.query(
            `INSERT INTO products
            (name, category_id, subcategory_id, base_unit,
             current_stock, minimum_stock, purchase_price, selling_price)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            RETURNING *`,
            [
                String(name).trim(),
                category_id || null,
                subcategory_id || null,
                String(base_unit).trim(),
                stock,
                minimum,
                purchase,
                selling
            ]
        );

        const product = result.rows[0];

        // Record opening stock in transaction history
        if (stock > 0) {
            await client.query(
                `INSERT INTO stock_transactions
                (product_id, transaction_type, quantity, unit,
                 conversion_factor, base_quantity, notes, created_by)
                VALUES ($1, 'IN', $2, $3, 1, $2, 'Opening stock', $4)`,
                [product.id, stock, product.base_unit, req.session.user.id]
            );
        }

        await client.query("COMMIT");

        res.status(201).json({
            success: true,
            message: "Product created successfully.",
            product
        });

    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Add product error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to create product."
        });
    } finally {
        client.release();
    }
});

// EDIT PRODUCT DETAILS (ADMIN ONLY)
router.put("/:id", requireAdmin, async (req, res) => {
    const {
        name,
        category_id,
        subcategory_id,
        base_unit,
        minimum_stock,
        purchase_price,
        selling_price
    } = req.body;

    const minimum = Number(minimum_stock);
    const purchase = Number(purchase_price);
    const selling = Number(selling_price);

    if (
        !name || !String(name).trim() || !base_unit ||
        !Number.isFinite(minimum) || minimum < 0 ||
        !Number.isFinite(purchase) || purchase < 0 ||
        !Number.isFinite(selling) || selling < 0
    ) {
        return res.status(400).json({
            success: false,
            message: "Please enter valid product details."
        });
    }

    try {
        if (subcategory_id) {
            const check = await pool.query(
                `SELECT id FROM subcategories
                 WHERE id = $1 AND category_id = $2`,
                [subcategory_id, category_id]
            );

            if (!check.rows.length) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid subcategory."
                });
            }
        }

        const result = await pool.query(
            `UPDATE products
             SET name = $1,
                 category_id = $2,
                 subcategory_id = $3,
                 base_unit = $4,
                 minimum_stock = $5,
                 purchase_price = $6,
                 selling_price = $7,
                 updated_at = NOW()
             WHERE id = $8 AND is_active = TRUE
             RETURNING *`,
            [
                String(name).trim(),
                category_id || null,
                subcategory_id || null,
                String(base_unit).trim(),
                minimum,
                purchase,
                selling,
                req.params.id
            ]
        );

        if (!result.rows.length) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        res.json({
            success: true,
            message: "Product updated successfully.",
            product: result.rows[0]
        });

    } catch (error) {
        console.error("Update product error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to update product."
        });
    }
});

// DEACTIVATE PRODUCT (ADMIN ONLY)
// Historical stock transactions remain محفوظ.
router.delete("/:id", requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE products
             SET is_active = FALSE, updated_at = NOW()
             WHERE id = $1 AND is_active = TRUE
             RETURNING id`,
            [req.params.id]
        );

        if (!result.rows.length) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        res.json({
            success: true,
            message: "Product deactivated successfully."
        });

    } catch (error) {
        console.error("Deactivate product error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to deactivate product."
        });
    }
});


// RECORD STOCK PURCHASES AND SALES. Quantity changes are atomic and audited.
router.post('/:id/transactions', requireLogin, async (req, res) => {
    const type = String(req.body.type || '').toUpperCase();
    const quantity = Number(req.body.quantity);
    const notes = req.body.notes ? String(req.body.notes).trim().slice(0, 500) : null;
    if (!['IN', 'OUT'].includes(type) || !Number.isFinite(quantity) || quantity <= 0) {
        return res.status(400).json({ success: false, message: 'Choose purchase or sale and enter a quantity greater than zero.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const locked = await client.query('SELECT id, current_stock, base_unit FROM products WHERE id=$1 AND is_active=TRUE FOR UPDATE', [req.params.id]);
        if (!locked.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Product not found.' });
        }
        const product = locked.rows[0];
        const current = Number(product.current_stock);
        if (type === 'OUT' && quantity > current) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: `Not enough stock. Available: ${current} ${product.base_unit}.` });
        }
        const delta = type === 'IN' ? quantity : -quantity;
        const updated = await client.query('UPDATE products SET current_stock=current_stock + $1, updated_at=NOW() WHERE id=$2 RETURNING current_stock', [delta, req.params.id]);
        const tx = await client.query(`INSERT INTO stock_transactions
            (product_id, transaction_type, quantity, unit, conversion_factor, base_quantity, notes, created_by)
            VALUES ($1,$2,$3,$4,1,$3,$5,$6) RETURNING id, created_at`,
            [req.params.id, type, quantity, product.base_unit, notes, req.session.user.id]);
        await client.query('COMMIT');
        res.status(201).json({ success: true, message: type === 'IN' ? 'Purchase recorded.' : 'Sale recorded.', current_stock: updated.rows[0].current_stock, transaction: tx.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Stock transaction error:', error);
        res.status(500).json({ success: false, message: 'Unable to record stock movement.' });
    } finally { client.release(); }
});

// Dashboard totals and today's sold quantity (database/server local date).
router.get('/summary/today', requireLogin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
              (SELECT COUNT(*) FROM products WHERE is_active=TRUE)::int AS total_products,
              (SELECT COUNT(*) FROM products WHERE is_active=TRUE AND current_stock <= minimum_stock)::int AS low_stock,
              COALESCE((SELECT SUM(base_quantity) FROM stock_transactions WHERE transaction_type='OUT' AND (created_at AT TIME ZONE 'Asia/Kathmandu')::date = (NOW() AT TIME ZONE 'Asia/Kathmandu')::date),0) AS sold_today,
              COALESCE((SELECT SUM(base_quantity) FROM stock_transactions WHERE transaction_type='IN' AND (created_at AT TIME ZONE 'Asia/Kathmandu')::date = (NOW() AT TIME ZONE 'Asia/Kathmandu')::date),0) AS purchased_today,
              (SELECT COUNT(*) FROM stock_transactions WHERE (created_at AT TIME ZONE 'Asia/Kathmandu')::date = (NOW() AT TIME ZONE 'Asia/Kathmandu')::date)::int AS transactions_today
        `);
        res.json({ success: true, summary: result.rows[0] });
    } catch (error) {
        console.error('Summary error:', error);
        res.status(500).json({ success: false, message: 'Unable to load dashboard summary.' });
    }
});

router.get('/transactions/recent', requireLogin, async (req, res) => {
    try {
        const result = await pool.query(`SELECT t.id, t.transaction_type, t.base_quantity, t.unit, t.notes, t.created_at, p.name AS product_name, u.username
          FROM stock_transactions t JOIN products p ON p.id=t.product_id LEFT JOIN users u ON u.id=t.created_by
          ORDER BY t.created_at DESC LIMIT 30`);
        res.json({ success: true, transactions: result.rows });
    } catch (error) {
        console.error('Recent transactions error:', error);
        res.status(500).json({ success: false, message: 'Unable to load transactions.' });
    }
});

module.exports = router;
