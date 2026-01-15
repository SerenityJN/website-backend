import express from "express";
import multer from "multer";
import bcrypt from "bcrypt";
import db from "../config/db.js"; // This must be your 'pg' Pool instance
import { sendEnrollmentEmail } from "../mailer/emailService.js";
import cloudinary from "../config/cloudinary.js";

const router = express.Router();

/* ===========================================================
   🗂️ CLOUDINARY FOLDER CREATION FUNCTION
   =========================================================== */
async function ensureCloudinaryFolder(lrn, lastname) {
  if (!lrn) return;
  const folderPath = `documents/${lrn}_${lastname?.toUpperCase() || 'STUDENT'}`;
  try {
    const transparentPixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    await cloudinary.uploader.upload(
      `data:image/png;base64,${transparentPixel}`,
      {
        public_id: 'folder_placeholder',
        folder: folderPath,
        overwrite: false
      }
    );
  } catch (error) {
    // Silently continue if folder exists or error occurs
  }
}

/* ===========================================================
   📤 MULTER CONFIGURATION - MEMORY STORAGE
   =========================================================== */
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
}).fields([
  { name: "birth_cert", maxCount: 1 },
  { name: "form137", maxCount: 1 },
  { name: "good_moral", maxCount: 1 },
  { name: "report_card", maxCount: 1 },
  { name: "picture", maxCount: 1 },
  { name: "transcript_records", maxCount: 1 },
  { name: "honorable_dismissal", maxCount: 1 },
]);

/* ===========================================================
   📁 CLOUDINARY FILE UPLOAD FUNCTION
   =========================================================== */
async function uploadFileToCloudinary(file, lrn, lastname, fieldname) {
  if (!file) return null;
  const folderPath = `documents/${lrn}_${lastname?.toUpperCase() || 'STUDENT'}`;
  
  return new Promise((resolve) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folderPath,
        public_id: fieldname,
        transformation: [{ quality: "auto", fetch_format: "auto" }],
        resource_type: 'auto'
      },
      (error, result) => {
        if (error) {
          console.error(`❌ Cloudinary upload failed for ${fieldname}:`, error);
          resolve(null);
        } else {
          resolve(result.secure_url);
        }
      }
    );
    uploadStream.end(file.buffer);
  });
}

/* ===========================================================
   🎓 ENROLLMENT ROUTE - COMPLETE POSTGRES VERSION
   =========================================================== */
router.post("/enroll", upload, async (req, res) => {
  // In pg library, we must use a dedicated client for Transactions
  const client = await db.connect();
  const { student_type } = req.body;

  if (!student_type) {
    client.release();
    return res.status(400).json({ success: false, message: "Student type is required." });
  }

  try {
    await client.query("BEGIN"); // Start Postgres Transaction
    let reference = "";

    // Handle New Enrollee and Transferee
    if (student_type === "New Enrollee" || student_type === "Transferee") {
      const {
        lrn, email, firstname, lastname, middlename, suffix, age, sex, status,
        nationality, birthdate, birth_province, birth_municipality, religion, 
        lot_blk, street, barangay, municipality, province, zipcode, 
        strand, phone, yearLevel,
        fathers_lastname, fathers_firstname, fathers_middlename, fathers_contact,
        mothers_lastname, mothers_firstname, mothers_middlename, mothers_contact,
        guardian_lastname, guardian_firstname, guardian_middlename, guardian_contact,
        ip_community, ip_specify, fourps_beneficiary, fourps_id
      } = req.body;

      // 🔍 DUPLICATE CHECKS
      const lrnCheck = await client.query("SELECT LRN FROM student_details WHERE LRN = $1 LIMIT 1", [lrn]);
      if (lrnCheck.rows.length > 0) {
        await client.query("ROLLBACK");
        client.release();
        return res.status(409).json({ success: false, message: "LRN already registered." });
      }
      
      const emailCheck = await client.query("SELECT email FROM student_details WHERE LOWER(email) = LOWER($1) LIMIT 1", [email]);
      if (emailCheck.rows.length > 0) {
        await client.query("ROLLBACK");
        client.release();
        return res.status(409).json({ success: false, message: "Email already registered." });
      }

      await ensureCloudinaryFolder(lrn, lastname);

      reference = "SV8BSHS-" + lrn;
      const home_add = `${lot_blk || ''}, ${street || ''}, ${barangay || ''}, ${municipality || ''}, ${province || ''} ${zipcode || ''}`;
      
      const ipCommunity = ip_community === "on" ? "Yes" : "No";
      const ipSpecifyValue = ip_community === "on" ? ip_specify : null;
      const fourpsBeneficiary = fourps_beneficiary === "on" ? "Yes" : "No";
      const fourpsIdValue = fourps_beneficiary === "on" ? fourps_id : null;

      // 🧍 Insert student details
      await client.query(
        `INSERT INTO student_details 
          (LRN, firstname, lastname, middlename, suffix, age, sex, status, nationality, birthdate,
           birth_province, birth_municipality, religion, cpnumber, home_add, email, yearlevel, strand, 
           student_type, enrollment_status, reason, ip_community, ip_specify, fourps_beneficiary, fourps_id, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 'Pending', NULL, $20, $21, $22, $23, CURRENT_TIMESTAMP)`,
        [
          lrn, firstname, lastname, middlename, suffix, age, sex, status, nationality,
          birthdate, birth_province, birth_municipality, religion, phone, home_add, 
          email, yearLevel, strand, student_type,
          ipCommunity, ipSpecifyValue, fourpsBeneficiary, fourpsIdValue
        ]
      );

      // 📎 UPLOAD FILES
      let fileUrls = { birth_cert: null, form137: null, good_moral: null, report_card: null, picture: null, transcript_records: null, honorable_dismissal: null };
      
      if (req.files) {
        for (const field of Object.keys(fileUrls)) {
          if (req.files[field]) {
            fileUrls[field] = await uploadFileToCloudinary(req.files[field][0], lrn, lastname, field);
          }
        }
      }

      // Insert document records
      await client.query(
        `INSERT INTO student_documents 
         (LRN, birth_cert, form137, good_moral, report_card, picture, transcript_records, honorable_dismissal)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [lrn, fileUrls.birth_cert, fileUrls.form137, fileUrls.good_moral, fileUrls.report_card, fileUrls.picture, fileUrls.transcript_records, fileUrls.honorable_dismissal]
      );

      // 👪 Parent/Guardian details
      const fathersName = `${fathers_firstname || ''} ${fathers_middlename || ''} ${fathers_lastname || ''}`.trim();
      const mothersName = `${mothers_firstname || ''} ${mothers_middlename || ''} ${mothers_lastname || ''}`.trim();
      const guardianName = `${guardian_firstname || ''} ${guardian_middlename || ''} ${guardian_lastname || ''}`.trim();

      await client.query(
        `INSERT INTO guardians 
         (LRN, FathersName, FathersContact, MothersName, MothersContact, GuardianName, GuardianContact)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [lrn, fathersName, fathers_contact, mothersName, mothers_contact, guardianName, guardian_contact]
      );

      await client.query(
        `INSERT INTO student_accounts (LRN, track_code, password) VALUES ($1, $2, $3)`,
        [lrn, reference, '']
      );

      const school_year = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
      
      await client.query(
        `INSERT INTO student_enrollments 
        (LRN, school_year, semester, status, grade_slip, rejection_reason, created_at, enrollment_type)
        VALUES ($1, $2, '1st', 'Pending', NULL, NULL, CURRENT_TIMESTAMP, $3)`,
        [lrn, school_year, student_type]
      );

    } else if (student_type === "Returnee") {
      await client.query("ROLLBACK");
      client.release();
      return res.status(501).json({ success: false, message: "Returnee enrollment is not yet implemented." });
    } else {
      await client.query("ROLLBACK");
      client.release();
      return res.status(400).json({ success: false, message: "Invalid student type." });
    }

    // ✅ Commit Transaction
    await client.query("COMMIT");

    /* ===========================================================
       📧 FULL EMAIL TEMPLATE
       =========================================================== */
    try {
      const emailToSend = req.body.email;
      const studentFirstName = req.body.firstname || "Student";
      const studentLastName = req.body.lastname || "";
      
      await sendEnrollmentEmail(
        emailToSend,
        "🎓 SV8BSHS Enrollment Confirmation",
        `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f8fafc; padding: 20px;">
          <div style="max-width: 600px; background: #fff; margin: auto; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); overflow: hidden;">
            <div style="background: #1e40af; color: #fff; text-align: center; padding: 20px;">
              <img src="https://upload.wikimedia.org/wikipedia/commons/2/24/LEGO_logo.svg" alt="SVSHS Logo" style="height: 60px; margin-bottom: 10px;">
              <h2 style="margin: 0;">SV8BSHS Enrollment Confirmation</h2>
            </div>
            <div style="padding: 25px;">
              <p>Dear <strong>${studentFirstName} ${studentLastName}</strong>,</p>
              <p>Thank you for enrolling at <strong>Southville 8B Senior High School (SV8BSHS)</strong>! Your application has been successfully received.</p>
              <p style="margin-top: 20px; font-size: 1.1em;">
                <strong>Reference Number:</strong> 
                <span style="display: inline-block; background: #f1f5f9; padding: 8px 12px; border-radius: 6px; margin-top: 4px;">${reference}</span>
              </p>
              <p style="margin-top: 20px;">You can track your enrollment status anytime using our official mobile app:</p>
              <p style="text-align: center; margin: 30px 0;">
                <a href="https://expo.dev/artifacts/eas/mVJUc8dzeB4ZrEFVia7wu8.apk" 
                  style="background-color: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
                  📱 View Enrollment Status
                </a>
              </p>
              <hr style="border:none; border-top:1px solid #e5e7eb; margin:30px 0;">
              <p style="font-size: 0.9em; color: #666;">This is an automated message — please do not reply. If you have any questions, contact us at <a href="mailto:342567@deped.gov.ph" style="color:#2563eb;">342567@deped.gov.ph</a>.</p>
              <p style="text-align:center; color:#aaa; font-size:0.8em; margin-top:20px;">© ${new Date().getFullYear()} Southville 8B Senior High School. All rights reserved.</p>
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
    await client.query("ROLLBACK");
    console.error("❌ Enrollment Transaction Error:", err);
    res.status(500).json({
      success: false,
      message: err.code === "23505" ? "LRN or Email already exists." : "An internal server error occurred.",
    });
  } finally {
    client.release(); // Important to release client back to pool
  }
});

/* ===========================================================
   🎓 GET STRANDS ROUTE
   =========================================================== */
router.get("/strands", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT strand_code, strand_name FROM strands ORDER BY strand_name ASC");
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error fetching strands:", err);
    res.status(500).json({ success: false, message: "Failed to fetch strands" });
  }
});

export default router;
