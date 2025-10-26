import express from "express";
import multer from "multer";
import path from "path";
import db from "../db.js";
import fs from "fs";

const router = express.Router();

// Upload config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "./uploads";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Register route
router.post("/register", upload.fields([
  { name: "birth_cert", maxCount: 1 },
  { name: "form137", maxCount: 1 },
  { name: "good_moral", maxCount: 1 },
]), async (req, res) => {
  try {
    const body = req.body;
    const files = req.files;

    // Generate random student ID
    const STD_ID = "STD" + Date.now().toString().slice(-6);

    // 1️⃣ Insert into student_details
    const studentDetails = {
      STD_ID,
      firstname: body.firstname,
      lastname: body.lastname,
      middlename: body.middlename,
      suffix: body.suffix,
      age: body.age,
      sex: body.sex,
      status: body.status,
      nationality: body.nationality,
      birthdate: body.birthdate,
      place_of_birth: body.place_of_birth,
      religion: body.religion,
      cpnumber: body.phone,
      home_add: `${body.lot_blk}, ${body.street}, ${body.barangay}, ${body.municipality}, ${body.province}, ${body.zipcode}`,
      email: body.email,
      yearlevel: body.yearLevel,
      strand: body.strand,
      student_status: body.student_status,
      created_at: new Date(),
    };

    await db.promise().query("INSERT INTO student_details SET ?", studentDetails);

    // 2️⃣ Insert into student_accounts
    await db.promise().query("INSERT INTO student_accounts SET ?", {
      STD_ID,
      password: body.password, // ⚠️ (you can hash later)
    });

    // 3️⃣ Insert into guardians
    await db.promise().query("INSERT INTO guardians SET ?", {
      STD_ID,
      name: body.guardian_name,
      relationship: body.relationship,
      contact: body.guardian_phone,
      occupation: body.occupation,
    });

    // 4️⃣ Insert into student_documents
    await db.promise().query("INSERT INTO student_documents SET ?", {
      STD_ID,
      birth_cert: files.birth_cert ? files.birth_cert[0].filename : "",
      form137: files.form137 ? files.form137[0].filename : "",
      good_moral: files.good_moral ? files.good_moral[0].filename : "",
    });

    res.json({
      success: true,
      STD_ID,
      message: "Student registered successfully!",
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Failed to register student." });
  }
});

export default router;
