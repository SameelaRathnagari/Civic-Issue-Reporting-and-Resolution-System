const mysql = require("mysql2");
require("dotenv").config(); // ✅ load env variables

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306 // ✅ optional but safe
});

db.connect(err => {
    if (err) {
        console.log("DB Connection Error:", err);
    } else {
        console.log("DB Connected");
    }
});

module.exports = db;