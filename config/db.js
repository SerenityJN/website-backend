import mysql from "mysql2";

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "admin", // update if you have one
  database: "enrollment_db",
});

db.connect((err) => {
  if (err) {
    console.error("❌ MySQL Connection Error:", err);
  } else {
    console.log("✅ Connected to MySQL Database");
  }
});

export default db;
