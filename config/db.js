const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

pool.on("error", (err) => {
    console.error("Unexpected database error:", err.message);
});

async function testConnection() {
    const result = await pool.query("SELECT NOW() AS current_time");
    console.log("Database connected successfully!");
    console.log("Database time:", result.rows[0].current_time);
}

module.exports = {
    pool,
    testConnection
};
