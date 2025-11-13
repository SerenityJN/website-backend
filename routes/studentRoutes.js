import express from "express";
import multer from "multer";
import bcrypt from "bcrypt";
import db from "../config/db.js";
import { sendEnrollmentEmail } from "../mailer/emailService.js";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const router = express.Router();

/* ===========================================================
   🗂️ CLOUDINARY FOLDER CREATION FUNCTION
   =========================================================== */
async function ensureCloudinaryFolder(lrn, lastname) {
  if (!lrn) {
    console.log('⚠️ No LRN provided for folder creation');
    return;
  }

  const folderPath = `documents/${lrn}_${lastname?.toUpperCase() || 'STUDENT'}`;
  console.log(`🔄 Creating Cloudinary folder: ${folderPath}`);
  
  try {
    // Upload a tiny 1x1 transparent PNG to force folder creation
    const transparentPixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    
    await cloudinary.uploader.upload(
      `data:image/png;base64,${transparentPixel}`,
      {
        public_id: 'folder_placeholder',
        folder: folderPath,
        overwrite: false
      }
    );
    
    console.log(`✅ Cloudinary folder created: ${folderPath}`);
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log(`📁 Cloudinary folder already exists: ${folderPath}`);
    } else {
      console.log(`⚠️ Cloudinary folder note: ${error.message}`);
    }
  }
}

/* ===========================================================
   📤 MULTER CONFIGURATION - USE MEMORY STORAGE
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
   🎓 ENROLLMENT ROUTE - FIXED
   =========================================================== */
router.post("/enroll", upload, async (req, res) => {
  const conn = await db.getConnection();
  const { student_type } = req.body;

  // 🎯 DEBUG LOG
  console.log("=== ENROLLMENT REQUEST ===");
  console.log("Student Type:", student_type);
  console.log("Has Files:", !!req.files);
  console.log("Request Body:", req.body);

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

      // ✅ ALWAYS CREATE CLOUDINARY FOLDER (EVEN WITH NO FILES)
      console.log("🔄 Creating Cloudinary folder...");
      await ensureCloudinaryFolder(lrn, lastname);

      // Validate required fields
      if (!lrn || !email || !firstname || !lastname || !yearLevel || !strand) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ 
          success: false, 
          message: "Missing required fields." 
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
        }
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

      await conn.query(
        `INSERT INTO student_accounts (LRN, track_code, password) VALUES (?, ?, ?)`,
        [lrn, reference, '']
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
    // Handle Returnee Students (your existing returnee code)
    else if (student_type === "Returnee") {
      // ... your existing returnee code ...
    }

    // ✅ Commit Transaction
    await conn.commit();

    // ... rest of your email and response code ...

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

