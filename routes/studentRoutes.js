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
   🎓 ENROLLMENT ROUTE - FIXED VERSION
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

    // Handle New Enrollee and Transferee
    if (student_type === "New Enrollee" || student_type === "Transferee") {
      const {
        lrn, email, firstname, lastname, middlename, suffix, age, sex, status,
        nationality, birthdate, birth_province, birth_municipality, religion, 
        lot_blk, street, barangay, municipality, province, zipcode, 
        strand, phone, last_school, yearLevel,
        // Parent/Guardian Information
        fathers_lastname, fathers_firstname, fathers_middlename, fathers_contact,
        mothers_lastname, mothers_firstname, mothers_middlename, mothers_contact,
        guardian_lastname, guardian_firstname, guardian_middlename, guardian_contact,
        // IP and 4Ps Information
        ip_community, ip_specify, fourps_beneficiary, fourps_id
      } = req.body;

      // Validate required fields
      if (!lrn || !email || !firstname || !lastname || !yearLevel || !strand) {
        conn.release();
        return res.status(400).json({ 
          success: false, 
          message: "Missing required fields: LRN, email, firstname, lastname, yearLevel, or strand." 
        });
      }

      // 🔍 Check for existing LRN or email
      const [exists] = await conn.query(
        "SELECT 1 FROM student_details WHERE LRN = ? OR email = ?", 
        [lrn, email]
      );
      if (exists.length > 0) {
        conn.release();
        return res.status(400).json({ 
          success: false, 
          message: "LRN or Email is already registered." 
        });
      }

      // 🏠 Combine address fields
      const home_add = `${lot_blk || ''}, ${street || ''}, ${barangay || ''}, ${municipality || ''}, ${province || ''} ${zipcode || ''}`;
      
      // Process IP Community data
      const ipCommunity = ip_community === "on" ? "Yes" : "No";
      const ipSpecifyValue = ip_community === "on" ? ip_specify : null;
      
      // Process 4Ps data
      const fourpsBeneficiary = fourps_beneficiary === "on" ? "Yes" : "No";
      const fourpsIdValue = fourps_beneficiary === "on" ? fourps_id : null;

      // 🧍 Insert student details
      await conn.query(
        `INSERT INTO student_details 
          (LRN, firstname, lastname, middlename, suffix, age, sex, status, nationality, birthdate,
           birth_province, birth_municipality, religion, cpnumber, home_add, email, yearlevel, strand, 
           student_type, enrollment_status, last_school, ip_community, ip_specify, fourps_beneficiary, fourps_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?, ?, NOW())`,
        [
          lrn, firstname, lastname, middlename, suffix, age, sex, status, nationality,
          birthdate, birth_province, birth_municipality, religion, phone, home_add, 
          email, yearLevel, strand, student_type, last_school,
          ipCommunity, ipSpecifyValue, fourpsBeneficiary, fourpsIdValue
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

      // 👪 Parent/Guardian details
      // Insert Father's information
      if (fathers_lastname && fathers_firstname) {
        await conn.query(
          `INSERT INTO guardians (LRN, lastname, firstname, middlename, contact, relationship) 
           VALUES (?, ?, ?, ?, ?, 'Father')`,
          [lrn, fathers_lastname, fathers_firstname, fathers_middlename, fathers_contact]
        );
      }

      // Insert Mother's information
      if (mothers_lastname && mothers_firstname) {
        await conn.query(
          `INSERT INTO guardians (LRN, lastname, firstname, middlename, contact, relationship) 
           VALUES (?, ?, ?, ?, ?, 'Mother')`,
          [lrn, mothers_lastname, mothers_firstname, mothers_middlename, mothers_contact]
        );
      }

      // Insert Guardian's information
      if (guardian_lastname && guardian_firstname) {
        await conn.query(
          `INSERT INTO guardians (LRN, lastname, firstname, middlename, contact, relationship) 
           VALUES (?, ?, ?, ?, ?, 'Guardian')`,
          [lrn, guardian_lastname, guardian_firstname, guardian_middlename, guardian_contact]
        );
      }

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
        VALUES (?, ?, ?, ?)`,
        [lrn, school_year, "1st", "Pending"]
      );

    } 
    // Handle Returnee Students
    else if (student_type === "Returnee") {
      const {
        returnee_lrn, returnee_email, returnee_phone,
        reason_leaving, reason_returning
      } = req.body;

      if (!returnee_lrn || !returnee_email) {
        conn.release();
        return res.status(400).json({ 
          success: false, 
          message: "Missing required fields for returnee: LRN and email." 
        });
      }

      // Check if returnee exists in the system
      const [existingStudent] = await conn.query(
        "SELECT * FROM student_details WHERE LRN = ? AND email = ?",
        [returnee_lrn, returnee_email]
      );

      if (existingStudent.length === 0) {
        conn.release();
        return res.status(400).json({ 
          success: false, 
          message: "No student found with the provided LRN and email. Please check your details." 
        });
      }

      // Update student record for returnee
      await conn.query(
        `UPDATE student_details 
         SET student_type = ?, enrollment_status = 'Pending', updated_at = NOW()
         WHERE LRN = ?`,
        [student_type, returnee_lrn]
      );

      // Insert returnee specific information
      await conn.query(
        `INSERT INTO returnee_details 
         (LRN, reason_leaving, reason_returning, return_date)
         VALUES (?, ?, ?, NOW())`,
        [returnee_lrn, reason_leaving, reason_returning]
      );

      // Generate reference number for returnee
      reference = "SV8BSHS-RET-" + String(returnee_lrn).padStart(6, "0");

      const now = new Date(); 
      const currentYear = now.getFullYear();
      const nextYear = currentYear + 1;
      const school_year = `${currentYear}-${nextYear}`;
      
      await conn.query(
        `INSERT INTO student_enrollments 
        (LRN, school_year, semester, status)
        VALUES (?, ?, ?, ?)`,
        [returnee_lrn, school_year, "1st", "Pending"]
      );
    }

    // ✅ Commit Transaction
    await conn.commit();

    /* ===========================================================
       📧 Send Enrollment Email
       =========================================================== */
    try {
      const studentName = req.body.firstname ? 
        `${req.body.firstname} ${req.body.lastname}` : 
        "Student";
      
      const studentEmail = req.body.email || req.body.returnee_email;

      await sendEnrollmentEmail(
        studentEmail,
        "🎓 SVSHS Enrollment Confirmation",
        `
        <div style="font-family:'Segoe UI',Arial,sans-serif;line-height:1.6;color:#333;background-color:#f8fafc;padding:20px;">
          <div style="max-width:600px;background:#fff;margin:auto;border-radius:8px;box-shadow:0 4px 10px rgba(0,0,0,0.05);overflow:hidden;">
            <div style="background:#1e40af;color:#fff;text-align:center;padding:20px;">
              <h2 style="margin:0;">SVSHS Enrollment Confirmation</h2>
            </div>
            <div style="padding:25px;">
              <p>Dear <strong>${studentName}</strong>,</p>
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
      // Don't fail the enrollment if email fails
    }

    res.status(200).json({
      success: true,
      reference,
      message: `Application submitted successfully. Reference: ${reference}`,
    });

  } catch (err) {
    await conn.rollback();
    console.error("❌ Enrollment Transaction Error:", err);
    
    let errorMessage = "An internal server error occurred.";
    if (err.code === "ER_DUP_ENTRY") {
      errorMessage = "LRN or Email already exists.";
    } else if (err.code === "ER_NO_REFERENCED_ROW") {
      errorMessage = "Referenced data not found.";
    } else if (err.code === "ER_DATA_TOO_LONG") {
      errorMessage = "Data too long for one or more fields.";
    }

    res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    conn.release();
  }
});

export default router;
