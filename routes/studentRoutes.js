import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcrypt from "bcrypt";
import db from "../config/db.js";
import { sendEnrollmentEmail } from "../mailer/emailService.js";

const router = express.Router();

// === Upload configuration ===
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname.replace(/\s/g, "_"));
  },
});
const upload = multer({
  storage,
}).fields([
  { name: "birth_cert", maxCount: 1 },
  { name: "form137", maxCount: 1 },
  { name: "good_moral", maxCount: 1 },
  { name: "report_card", maxCount: 1 },
  { name: "transcript_records", maxCount: 1 },
  { name: "honorable_dismissal", maxCount: 1 },
]);

// === ENROLLMENT ROUTE ===
router.post("/enroll", upload, async (req, res) => {
  const conn = await db.getConnection();
  const { student_type } = req.body;

  if (!student_type) {
    conn.release();
    return res.status(400).json({ success: false, message: "Student type is required." });
  }

  try {
    await conn.beginTransaction();

    let reference = "";

    if (student_type === "New Enrollee" || student_type === "Transferee") {
      const {
        lrn, email, firstname, lastname, middlename, suffix, age, sex, status,
        nationality, birthdate, place_of_birth, religion, lot_blk, street,
        barangay, municipality, province, zipcode, strand, phone,
        guardian_name, guardian_phone
      } = req.body;

      let { yearLevel } = req.body;
      if (student_type === "New Enrollee") yearLevel = "Grade 11";

      if (!lrn || !email || !firstname || !lastname || !yearLevel || !strand) {
        conn.release();
        return res.status(400).json({ success: false, message: "Missing required fields." });
      }

      const [exists] = await conn.query("SELECT 1 FROM student_details WHERE LRN = ? OR email = ?", [lrn, email]);
      if (exists.length > 0) {
        conn.release();
        return res.status(400).json({ success: false, message: "LRN or Email is already registered." });
      }

      const home_add = `${lot_blk}, ${street}, ${barangay}, ${municipality}, ${province} ${zipcode}`;

      await conn.query(
        `INSERT INTO student_details 
          (LRN, firstname, lastname, middlename, suffix, age, sex, status, nationality, birthdate,
           place_of_birth, religion, cpnumber, home_add, email, yearlevel, strand, 
           student_type, enrollment_status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NOW())`,
        [
          lrn, firstname, lastname, middlename, suffix, age, sex, status, nationality,
          birthdate, place_of_birth, religion, phone, home_add, email, yearLevel,
          strand, student_type,
        ]
      );

      const birthCert = req.files["birth_cert"]?.[0]?.filename || null;
      let form137 = null, goodMoral = null, reportCard = null;
      let transcriptRecords = null, honorableDismissal = null;

      if (student_type === "New Enrollee") {
        form137 = req.files["form137"]?.[0]?.filename || null;
        goodMoral = req.files["good_moral"]?.[0]?.filename || null;
        reportCard = req.files["report_card"]?.[0]?.filename || null;
      } else if (student_type === "Transferee") {
        transcriptRecords = req.files["transcript_records"]?.[0]?.filename || null;
        honorableDismissal = req.files["honorable_dismissal"]?.[0]?.filename || null;
      }

      await conn.query(
        `INSERT INTO student_documents 
         (LRN, birth_cert, form137, good_moral, report_card, transcript_records, honorable_dismissal)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [lrn, birthCert, form137, goodMoral, reportCard, transcriptRecords, honorableDismissal]
      );

      await conn.query(
        `INSERT INTO guardians (LRN, name, contact) VALUES (?, ?, ?)`,
        [lrn, guardian_name, guardian_phone]
      );

      // ✅ Generate reference number
      reference = "SVSHS-" + String(lrn).padStart(6, "0");

      await conn.query(
        `INSERT INTO student_accounts (LRN, track_code) VALUES (?, ?)`,
        [lrn, reference]
      );
    }

    // ✅ Commit
    await conn.commit();

    // ✅ Send Email Notification AFTER commit
    try {
      await sendEnrollmentEmail(
      req.body.email,
      "🎓 SVSHS Enrollment Confirmation",
      `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f8fafc; padding: 20px;">
        <div style="max-width: 600px; background: #fff; margin: auto; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); overflow: hidden;">
          <div style="background: #1e40af; color: #fff; text-align: center; padding: 20px;">
            <img src="https://commons.wikimedia.org/wiki/File:LEGO_logo.svg" alt="SVSHS Logo" style="height: 60px; margin-bottom: 10px;">
            <h2 style="margin: 0;">SVSHS Enrollment Confirmation</h2>
          </div>

          <div style="padding: 25px;">
            <p>Dear <strong>${req.body.firstname} ${req.body.lastname}</strong>,</p>
            <p>Thank you for enrolling at <strong>San Vicente Senior High School (SVSHS)</strong>! Your application has been successfully received.</p>

            <p style="margin-top: 20px; font-size: 1.1em;">
              <strong>Reference Number:</strong> 
              <span style="display: inline-block; background: #f1f5f9; padding: 8px 12px; border-radius: 6px; margin-top: 4px;">
                ${reference}
              </span>
            </p>

            <p style="margin-top: 20px;">You can track your enrollment status anytime using our official mobile app:</p>

            <p style="text-align: center; margin: 30px 0;">
              <a href="https://your-mobile-app-link.com" 
                style="background-color: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
                📱 View Enrollment Status
              </a>
            </p>

            <p>Or download our mobile app directly from the Google Play Store:</p>
            <p style="text-align: center;">
              <a href="https://play.google.com/store/apps/details?id=com.yourschool.app" 
                style="color: #2563eb; text-decoration: none; font-weight: 500;">
                👉 Download SVSHS Mobile App
              </a>
            </p>

            <hr style="border:none; border-top:1px solid #e5e7eb; margin:30px 0;">

            <p style="font-size: 0.9em; color: #666;">
              This is an automated message — please do not reply.<br>
              If you have any questions, contact us at 
              <a href="mailto:svshs.enrollment@gmail.com" style="color:#2563eb;">svshs.enrollment@gmail.com</a>.
            </p>

            <p style="text-align:center; color:#aaa; font-size:0.8em; margin-top:20px;">
              © ${new Date().getFullYear()} San Vicente Senior High School. All rights reserved.
            </p>
          </div>
        </div>
      </div>
      `
    );


    } catch (mailError) {
      console.error("⚠️ Email send failed:", mailError);
      // (Don’t rollback here, since enrollment was already successful)
    }

    res.status(200).json({
      success: true,
      reference,
      message: `Application submitted successfully. Reference: ${reference}`,
    });

  } catch (err) {
    await conn.rollback();
    console.error("❌ Enrollment Transaction Error:", err);
    res.status(500).json({
      success: false,
      message: err.code === "ER_DUP_ENTRY"
        ? "LRN or Email already exists."
        : "An internal server error occurred.",
    });
  } finally {
    conn.release();
  }
});

export default router;
