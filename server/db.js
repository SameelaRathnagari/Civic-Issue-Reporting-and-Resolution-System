const mysql = require("mysql2");

const db = mysql.createConnection(process.env.DATABASE_URL);

db.connect(err => {
    if (err) {
        console.log("DB Error:", err);
    } else {
        console.log("DB Connected");
    }
});

module.exports = db;