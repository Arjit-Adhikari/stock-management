
const express = require("express");
const router = express.Router();

const { pool } = require("../config/db");
const { hashPassword } = require("../config/auth");
const { requireAdmin } = require("../middleware/auth");

// GET ALL USERS — ADMIN ONLY
router.get("/", requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, username, role, is_active, created_at
             FROM users
             ORDER BY id DESC`
        );

        res.json({
            success: true,
            users: result.rows
        });

    } catch (error) {
        console.error("Users fetch error:", error.message);

        res.status(500).json({
            success: false,
            message: "Could not fetch users."
        });
    }
});

// CREATE STAFF — ADMIN ONLY
router.post("/", requireAdmin, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required."
            });
        }

        const cleanUsername = username.trim();

        if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(cleanUsername)) {
            return res.status(400).json({
                success: false,
                message: "Username must be 3-30 characters and use letters, numbers, dots, underscores or hyphens."
            });
        }

        if (password.length < 12) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 12 characters."
            });
        }

        const existingUser = await pool.query(
            "SELECT id FROM users WHERE username = $1",
            [cleanUsername]
        );

        if (existingUser.rowCount > 0) {
            return res.status(409).json({
                success: false,
                message: "Username already exists."
            });
        }

        const passwordHash = await hashPassword(password);

        const result = await pool.query(
            `INSERT INTO users (username, password_hash, role)
             VALUES ($1, $2, 'staff')
             RETURNING id, username, role, is_active, created_at`,
            [cleanUsername, passwordHash]
        );

        res.status(201).json({
            success: true,
            message: "Staff account created successfully.",
            user: result.rows[0]
        });

    } catch (error) {
        console.error("Staff creation error:", error.message);

        res.status(500).json({
            success: false,
            message: "Could not create staff account."
        });
    }
});

// ACTIVATE / DEACTIVATE USER — ADMIN ONLY
router.patch("/:id/status", requireAdmin, async (req, res) => {
    try {
        const userId = Number(req.params.id);
        const { is_active } = req.body;

        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID."
            });
        }

        if (typeof is_active !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "is_active must be true or false."
            });
        }

        if (userId === Number(req.session.user.id)) {
            return res.status(400).json({
                success: false,
                message: "You cannot deactivate your own account."
            });
        }

        const result = await pool.query(
            `UPDATE users
             SET is_active = $1
             WHERE id = $2
             RETURNING id, username, role, is_active`,
            [is_active, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        res.json({
            success: true,
            message: "User status updated successfully.",
            user: result.rows[0]
        });

    } catch (error) {
        console.error("User status error:", error.message);

        res.status(500).json({
            success: false,
            message: "Could not update user status."
        });
    }
});

module.exports = router;
