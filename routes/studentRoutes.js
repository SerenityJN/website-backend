import express from "express";
import multer from "multer";
import bcrypt from "bcrypt";
import db from "../config/db.js";
import { sendEnrollmentEmail } from "../mailer/emailService.js";
import cloudinary from "../config/cloudinary.js";

const router = express.Router();

/* ===========================================================
   🗂️ CLOUDINARY FOLDER CREATION FUNCTION
   =========================================================== */
async function ensureCloudinaryFolder(lrn, lastname) {
  if (!lrn) {
    console.log('⚠️ No LRN provided for folder creation');
    return false;
  }

  const folderPath = `documents/${lrn}_${lastname?.toUpperCase() || 'STUDENT'}`;
  console.log(`🔄 Attempting to create Cloudinary folder: ${folderPath}`);
  
  try {
    // Upload a tiny 1x1 transparent PNG to force folder creation
    const transparentPixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    
    const result = await cloudinary.uploader.upload(
      `data:image/png;base64,${transparentPixel}`,
      {
        public_id: 'folder_placeholder',
        folder: folderPath,
        overwrite: false,
        resource_type: 'image'
      }
    );
    
    console.log(`✅ Cloudinary folder CREATED SUCCESSFULLY: ${folderPath}`);
    console.log(`📁 Folder URL: ${result.secure_url}`);
    return true;
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log(`📁 Cloudinary folder already exists: ${folderPath}`);
      return true;
    } else {
      console.error(`❌ Cloudinary folder creation FAILED:`, error.message);
      return false;
    }
  }
}

/* ===========================================================
   📤 MULTER CONFIGURATION - SIMPLE MEMORY STORAGE
   =========================================================== */
const upload = multer({ 
  storage: multer.memoryStorage(), // Use memory storage
  fileFilter: (req, file, cb) => {
    cb(null, true);
  }
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
  
  return new Promise((resolve, reject) => {
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
          console.log(`✅ File uploaded to Cloudinary: ${fieldname}`);
          resolve(result.secure_url);
        }
      }
    );
    
    uploadStream.end(file.buffer);
  });
}

/* ===========================================================
   🎓 ENROLLMENT ROUTE - COMPLETE FIX
   =========================================================== */
router.post("/enroll", upload, async (req, res) => {
  const conn = await db.getConnection();
  
  // 🎯 EXTENSIVE DEBUG LOGGING
  console.log("=== ENROLLMENT REQUEST STARTED ===");
  console.log("Student Type:", req.body.student_type);
  console.log("LRN:", req.body.lrn);
  console.log("Lastname:", req.body.lastname);
  console.log("Has Files:", !!req.files);
  console.log("Files:", req.files);

  const { student_type } = req.body;

  if (!student_type) {
    conn.release();
    return res.status(400).json({ success: false, message: "Student type is required." });
  }

  try {
    await conn.beginTransaction();
    let reference = "";
    let studentLRN = "";

    // Handle New Enrollee and Transferee
    if (student_type === "New Enrollee" || student_type === "Transferee") {
      const {
        lrn, email, firstname, lastname, middlename, suffix, age, sex, status,
        nationality, birthdate, birth_province, birth_municipality, religion, 
        lot_blk, street, barangay, municipality, province, zipcode, 
        strand, phone, last_school, yearLevel,
        fathers_lastname, fathers_firstname, fathers_middlename, fathers_contact,
        mothers_lastname, mothers_firstname, mothers_middlename, mothers_contact,
        guardian_lastname, guardian_firstname, guardian_middlename, guardian_contact,
        ip_community, ip_specify, fourps_beneficiary, fourps_id
      } = req.body;

      studentLRN = lrn;

      // ✅ FORCE CLOUDINARY FOLDER CREATION (ALWAYS CALL THIS)
      console.log("🔄 FORCING CLOUDINARY FOLDER CREATION...");
      const folderCreated = await ensureCloudinaryFolder(lrn, lastname);
      
      if (folderCreated) {
        console.log("🎉 SUCCESS: Cloudinary folder creation completed!");
      } else {
        console.log("⚠️ WARNING: Cloudinary folder may not have been created");
      }

      // Validate required fields
      if (!lrn || !email || !firstname || !lastname || !yearLevel || !strand) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ 
          success: false, 
          message: "Missing required fields." 
        });
      }

      // 🔍 Check for existing LRN or email
      const [exists] = await conn.query(
        "SELECT 1 FROM student_details WHERE LRN = ? OR email = ?", 
        [lrn, email]
      );
      if (exists.length > 0) {
        await conn.rollback();
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
           student_type, enrollment_status, reason, ip_community, ip_specify, fourps_beneficiary, fourps_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NULL, ?, ?, ?, ?, NOW())`,
        [
          lrn, firstname, lastname, middlename, suffix, age, sex, status, nationality,
          birthdate, birth_province, birth_municipality, religion, phone, home_add, 
          email, yearLevel, strand, student_type,
          ipCommunity, ipSpecifyValue, fourpsBeneficiary, fourpsIdValue
        ]
      );

      /* ===========================================================
         📎 UPLOAD FILES TO CLOUDINARY (IF ANY EXIST)
         =========================================================== */
      let birthCert = null;
      let form137 = null;
      let goodMoral = null;
      let reportCard = null;
      let picture = null;
      let transcriptRecords = null;
      let honorableDismissal = null;

      // Upload files if they exist
      if (req.files) {
        console.log(`📁 Uploading ${Object.keys(req.files).length} files to Cloudinary...`);
        
        const uploadPromises = [];
        
        if (req.files["birth_cert"]) {
          uploadPromises.push(
            uploadFileToCloudinary(req.files["birth_cert"][0], lrn, lastname, "birth_cert")
              .then(url => { birthCert = url; })
          );
        }
        
        if (req.files["form137"]) {
          uploadPromises.push(
            uploadFileToCloudinary(req.files["form137"][0], lrn, lastname, "form137")
              .then(url => { form137 = url; })
          );
        }
        
        if (req.files["good_moral"]) {
          uploadPromises.push(
            uploadFileToCloudinary(req.files["good_moral"][0], lrn, lastname, "good_moral")
              .then(url => { goodMoral = url; })
          );
        }
        
        if (req.files["report_card"]) {
          uploadPromises.push(
            uploadFileToCloudinary(req.files["report_card"][0], lrn, lastname, "report_card")
              .then(url => { reportCard = url; })
          );
        }
        
        if (req.files["picture"]) {
          uploadPromises.push(
            uploadFileToCloudinary(req.files["picture"][0], lrn, lastname, "picture")
              .then(url => { picture = url; })
          );
        }
        
        if (req.files["transcript_records"]) {
          uploadPromises.push(
            uploadFileToCloudinary(req.files["transcript_records"][0], lrn, lastname, "transcript_records")
              .then(url => { transcriptRecords = url; })
          );
        }
        
        if (req.files["honorable_dismissal"]) {
          uploadPromises.push(
            uploadFileToCloudinary(req.files["honorable_dismissal"][0], lrn, lastname, "honorable_dismissal")
              .then(url => { honorableDismissal = url; })
          );
        }

        // Wait for all uploads to complete
        if (uploadPromises.length > 0) {
          await Promise.all(uploadPromises);
          console.log("✅ All file uploads completed");
        } else {
          console.log("ℹ️ No files to upload");
        }
      } else {
        console.log("ℹ️ No files were uploaded by user");
      }

      // Insert document records (URLs will be null if no files uploaded)
      await conn.query(
        `INSERT INTO student_documents 
         (LRN, birth_cert, form137, good_moral, report_card, picture, transcript_records, honorable_dismissal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [lrn, birthCert, form137, goodMoral, reportCard, picture, transcriptRecords, honorableDismissal]
      );

      // 👪 Parent/Guardian details
      const fathersName = `${fathers_firstname || ''} ${fathers_middlename || ''} ${fathers_lastname || ''}`.trim();
      const mothersName = `${mothers_firstname || ''} ${mothers_middlename || ''} ${mothers_lastname || ''}`.trim();
      const guardianName = `${guardian_firstname || ''} ${guardian_middlename || ''} ${guardian_lastname || ''}`.trim();

      await conn.query(
        `INSERT INTO guardians 
         (LRN, FathersName, FathersContact, MothersName, MothersContact, GuardianName, GuardianContact)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          lrn, 
          fathersName, fathers_contact,
          mothersName, mothers_contact,
          guardianName, guardian_contact
        ]
      );

      // 🔢 Generate Reference Number
      reference = "SV8BSHS-" + String(lrn).padStart(6, "0");

      // Generate default password
      const defaultPassword = lastname.substring(0, 4).toLowerCase() + lrn.slice(-4);
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      await conn.query(
        `INSERT INTO student_accounts (LRN, track_code, password) VALUES (?, ?, ?)`,
        [lrn, reference, hashedPassword]
      );

      const now = new Date(); 
      const currentYear = now.getFullYear();
      const nextYear = currentYear + 1;
      const school_year = `${currentYear}-${nextYear}`;
      
      // Insert into student_enrollment
      await conn.query(
        `INSERT INTO student_enrollments 
        (LRN, school_year, semester, status, grade_slip, rejection_reason, created_at)
        VALUES (?, ?, '1st', 'Pending', NULL, NULL, NOW())`,
        [lrn, school_year]
      );

    } 
    // Handle Returnee Students
    else if (student_type === "Returnee") {
      const {
        returnee_lrn, returnee_email, returnee_phone,
        reason_leaving, reason_returning
      } = req.body;

      studentLRN = returnee_lrn;

      if (!returnee_lrn || !returnee_email) {
        await conn.rollback();
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
        await conn.rollback();
        conn.release();
        return res.status(400).json({ 
          success: false, 
          message: "No student found with the provided LRN and email. Please check your details." 
        });
      }

      // Update student record for returnee
      await conn.query(
        `UPDATE student_details 
         SET student_type = ?, enrollment_status = 'Pending'
         WHERE LRN = ?`,
        [student_type, returnee_lrn]
      );

      // Generate reference number for returnee
      reference = "SV8BSHS-RET-" + String(returnee_lrn).padStart(6, "0");

      const now = new Date(); 
      const currentYear = now.getFullYear();
      const nextYear = currentYear + 1;
      const school_year = `${currentYear}-${nextYear}`;
      
      await conn.query(
        `INSERT INTO student_enrollments 
        (LRN, school_year, semester, status, grade_slip, rejection_reason, created_at)
        VALUES (?, ?, '1st', 'Pending', NULL, NULL, NOW())`,
        [returnee_lrn, school_year]
      );
    }

    // ✅ Commit Transaction
    await conn.commit();
    console.log("✅ Database transaction committed successfully");

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
        "🎓 SV8BSHS Enrollment Confirmation",
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
                © ${new Date().getFullYear()} Southville 8B Senior High School. All rights reserved.
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
