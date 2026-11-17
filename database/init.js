require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { pool } = require("../config/db");

async function initializeDatabase() {
    try {
        const schemaPath = path.join(__dirname, "schema.sql");
        const schema = fs.readFileSync(schemaPath, "utf8");

        // Execute each SQL statement separately
        const statements = schema
            .split(";")
            .map(statement => statement.trim())
            .filter(statement => statement.length > 0);

        console.log(`Found ${statements.length} SQL statements.`);

        for (let i = 0; i < statements.length; i++) {
            try {
                await pool.query(statements[i]);
                console.log(`Statement ${i + 1} successful.`);
            } catch (error) {
                console.error(`Error in statement ${i + 1}:`);
                console.error(error.message);
                console.error(statements[i]);
                throw error;
            }
        }

        console.log("\nDATABASE TABLES CREATED SUCCESSFULLY!");

    } catch (error) {
        console.error("\nDATABASE INITIALIZATION FAILED!");
        console.error(error.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

initializeDatabase();
