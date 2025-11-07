import express from "express";
import multer from "multer";
import bcrypt from "bcrypt";
import db from "../config/db.js";
import { sendEnrollmentEmail } from "../mailer/emailService.js";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const router = express.Router();

/* ===========================================================
   📤 CLOUDINARY STORAGE CONFIGURATION
   Each student’s files go to: document/{LRN LASTNAME}/
   Example: document/65474554335 NUARIN/
   =========================================================== */
const documentStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const { lrn, lastname } = req.body;
    const folderPath = `document/${lrn} ${lastname?.toUpperCase()}`;
    const fileLabel = file.fieldname; 

    return {
      folder: folderPath,
      format: file.mimetype.split("/")[1] || "jpg",
      public_id: fileLabel, 
      transformation: [{ quality: "auto", fetch_format: "auto" }],
    };
  },
});

const upload = multer({ storage: documentStorage }).fields([
  { name: "birth_cert", maxCount: 1 },
  { name: "form137", maxCount: 1 },
  { name: "good_moral", maxCount: 1 },
  { name: "report_card", maxCount: 1 },
  { name: "transcript_records", maxCount: 1 },
  { name: "honorable_dismissal", maxCount: 1 },
]);

/* ===========================================================
   🎓 ENROLLMENT ROUTE
   =========================================================== */
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

      // 🔍 Check for existing LRN or email
      const [exists] = await conn.query("SELECT 1 FROM student_details WHERE LRN = ? OR email = ?", [lrn, email]);
      if (exists.length > 0) {
        conn.release();
        return res.status(400).json({ success: false, message: "LRN or Email is already registered." });
      }

      // 🏠 Combine address fields
      const home_add = `${lot_blk}, ${street}, ${barangay}, ${municipality}, ${province} ${zipcode}`;

      // 🧍 Insert student details
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

      /* ===========================================================
         📎 Handle Cloudinary URLs
         =========================================================== */
      const birthCert = req.files["birth_cert"]?.[0]?.path || null;
      const form137 = req.files["form137"]?.[0]?.path || null;
      const goodMoral = req.files["good_moral"]?.[0]?.path || null;
      const reportCard = req.files["report_card"]?.[0]?.path || null;
      const transcriptRecords = req.files["transcript_records"]?.[0]?.path || null;
      const honorableDismissal = req.files["honorable_dismissal"]?.[0]?.path || null;

      await conn.query(
        `INSERT INTO student_documents 
         (LRN, birth_cert, form137, good_moral, report_card, transcript_records, honorable_dismissal)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [lrn, birthCert, form137, goodMoral, reportCard, transcriptRecords, honorableDismissal]
      );

      // 👪 Guardian details
      await conn.query(
        `INSERT INTO guardians (LRN, name, contact) VALUES (?, ?, ?)`,
        [lrn, guardian_name, guardian_phone]
      );

      // 🔢 Generate Reference Number
      reference = "SV8BSHS-" + String(lrn).padStart(6, "0");

      await conn.query(
        `INSERT INTO student_accounts (LRN, track_code) VALUES (?, ?)`,
        [lrn, reference]
      );

      const now = new Date();
      const currentYear = now.getFullYear();
      const nextYear = currentYear + 1;
      const school_year = `${currentYear}-${nextYear}`;
      await conn.query(
        `INSERT INTO student_enrollments 
        (LRN, school_year, semester, status)
        VALUES (?, ?, ?, 'Pending')`,
        [lrn, school_year, semester]
      );

    }

    // ✅ Commit Transaction
    await conn.commit();

    /* ===========================================================
       📧 Send Enrollment Email
       =========================================================== */
    try {
      await sendEnrollmentEmail(
        req.body.email,
        "🎓 SVSHS Enrollment Confirmation",
        `
        <div style="font-family:'Segoe UI',Arial,sans-serif;line-height:1.6;color:#333;background-color:#f8fafc;padding:20px;">
          <div style="max-width:600px;background:#fff;margin:auto;border-radius:8px;box-shadow:0 4px 10px rgba(0,0,0,0.05);overflow:hidden;">
            <div style="background:#1e40af;color:#fff;text-align:center;padding:20px;">
              <h2 style="margin:0;">SVSHS Enrollment Confirmation</h2>
            </div>
            <div style="padding:25px;">
              <p>Dear <strong>${req.body.firstname} ${req.body.lastname}</strong>,</p>
              <p>Thank you for enrolling at <strong>Southville 8B Senior High School (SV8BSHS)</strong>!</p>
              <p>Your application has been successfully received.</p>

              <p style="margin-top:20px;font-size:1.1em;">
                <strong>Reference Number:</strong> 
                <span style="display:inline-block;background:#f1f5f9;padding:8px 12px;border-radius:6px;margin-top:4px;">
                  ${reference}
                </span>
              </p>

              <p>Use this reference number to track your enrollment status anytime using our mobile app:</p>
              <p style="text-align:center;margin:30px 0;">
                <a href="https://expo.dev/artifacts/eas/cHDTduGiqavaz43NmcK9sb.apk"
                  style="background-color:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:500;">
                  📱 View Enrollment Status
                </a>
              </p>

              <hr style="border:none;border-top:1px solid #e5e7eb;margin:30px 0;">
              <p style="font-size:0.9em;color:#666;">This is an automated message — please do not reply.</p>
              <p style="text-align:center;color:#aaa;font-size:0.8em;margin-top:20px;">
                © ${new Date().getFullYear()} San Vicente Senior High School. All rights reserved.
              </p>
            </div>
          </div>
        </div>
        `
      );
    } catch (mailError) {
      console.error("⚠️ Email send failed:", mailError);
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
