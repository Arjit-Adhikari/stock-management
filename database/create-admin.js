
require("dotenv").config();

const { pool } = require("../config/db");
const { hashPassword } = require("../config/auth");

async function createAdmin() {
    try {
        const username = process.env.ADMIN_USERNAME;
        const password = process.env.ADMIN_PASSWORD;

        if (!username || !password) {
            throw new Error("Admin credentials missing in .env");
        }

        if (password.length < 12) {
            throw new Error("Admin password must be at least 12 characters.");
        }

        const existingUser = await pool.query(
            "SELECT id FROM users WHERE username = $1",
            [username]
        );

        if (existingUser.rowCount > 0) {
            console.log("Admin account already exists.");
            return;
        }

        const passwordHash = await hashPassword(password);

        await pool.query(
            `INSERT INTO users (username, password_hash, role)
             VALUES ($1, $2, 'admin')`,
            [username, passwordHash]
        );

        console.log("Admin account created successfully!");

    } catch (error) {
        console.error("Admin creation failed:", error.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

createAdmin();
