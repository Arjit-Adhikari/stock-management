require("dotenv").config();

const { testConnection, pool } = require("./config/db");

async function startTest() {
    try {
        await testConnection();
    } catch (error) {
        console.error("Database connection failed:");
        console.error(error.message);
    } finally {
        await pool.end();
    }
}

startTest();
