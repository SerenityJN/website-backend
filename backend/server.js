import express from "express";
import multer from "multer";
import cors from "cors";
import path from "path";
import fs from "fs";
import bcrypt from "bcrypt";
import db from "./config/db.js"; // adjust if needed

const app = express();
const PORT = 5000;

// Enable CORS
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001"] // frontend URLs
}));

// Parse JSON and urlencoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads folder exists
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// ------------------ TEST ROUTE ------------------
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend is working ✅" });
});

// ------------------ ENROLLMENT ROUTE ------------------
app.post(
  "/api/enroll",
  upload.fields([
    { name: "birth_cert", maxCount: 1 },
    { name: "form137", maxCount: 1 },
    { name: "good_moral", maxCount: 1 },
  ]),
  async (req, res) => {
    const conn = db.promise();
    const STD_ID = "STD" + Date.now();
    const { email, password } = req.body;

    try {
      // Check for duplicate email
      const [existing] = await conn.query(
        "SELECT 1 FROM student_details WHERE email = ?",
        [email]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: "Email already registered." });
      }

      await conn.query("START TRANSACTION");

      // 1️⃣ student_details
      const {
        firstname, lastname, middlename, suffix,
        age, sex, status, nationality, birthdate, place_of_birth,
        religion, lot_blk, street, barangay, municipality, province,
        zipcode, yearLevel, strand, student_status, phone,
        guardian_name, relationship, guardian_phone, occupation
      } = req.body;

      const home_add = `${lot_blk}, ${street}, ${barangay}, ${municipality}, ${province} ${zipcode}`;

      await conn.query(
        `INSERT INTO student_details 
        (STD_ID, firstname, lastname, middlename, suffix, age, sex, status, nationality, birthdate,
         place_of_birth, religion, cpnumber, home_add, email, yearlevel, strand, student_status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [STD_ID, firstname, lastname, middlename, suffix, age, sex, status, nationality, birthdate,
         place_of_birth, religion, phone, home_add, email, yearLevel, strand, student_status]
      );

      // 2️⃣ student_accounts (hash password!)
      const hashedPassword = await bcrypt.hash(password, 10);
      await conn.query(
        `INSERT INTO student_accounts (STD_ID, password) VALUES (?, ?)`,
        [STD_ID, hashedPassword]
      );

      // 3️⃣ student_documents
      const birthCert = req.files["birth_cert"]?.[0]?.filename || null;
      const form137 = req.files["form137"]?.[0]?.filename || null;
      const goodMoral = req.files["good_moral"]?.[0]?.filename || null;

      await conn.query(
        `INSERT INTO student_documents (STD_ID, birth_cert, form137, good_moral) VALUES (?, ?, ?, ?)`,
        [STD_ID, birthCert, form137, goodMoral]
      );

      // 4️⃣ guardians
      await conn.query(
        `INSERT INTO guardians (STD_ID, name, relationship, contact, occupation) VALUES (?, ?, ?, ?, ?)`,
        [STD_ID, guardian_name, relationship, guardian_phone, occupation]
      );

      await conn.query("COMMIT");

      res.json({ success: true, STD_ID, message: "Enrollment submitted successfully." });
    } catch (err) {
      await conn.query("ROLLBACK");
      console.error("❌ Enrollment error:", err);
      res.status(500).json({ error: err.code === "ER_DUP_ENTRY" ? "Email already exists." : "Enrollment failed." });
    }
  }
);

// Serve uploaded files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Start server
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
