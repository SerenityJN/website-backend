import express from "express";
import multer from "multer";
import db from "../config/db.js";
import { sendEnrollmentEmail } from "../mailer/emailService.js";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const router = express.Router();

/* ===========================================================
   📤 CLOUDINARY STORAGE FOR 2ND SEMESTER (Grade Slip Only)
   =========================================================== */
const secondSemesterStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const { lrn, lastname } = req.body;
    const folderPath = `enrollments/${lrn}_${lastname?.toUpperCase() || 'STUDENT'}/2nd_sem`;
    
    return {
      folder: folderPath,
      format: file.mimetype.split("/")[1] || "jpg",
      public_id: `grade_slip_${Date.now()}`,
      transformation: [{ quality: "auto", fetch_format: "auto" }],
    };
  },
});

const uploadGradeSlip = multer({ 
  storage: secondSemesterStorage 
}).single("grade_slip");

/* ===========================================================
   🎓 2ND SEMESTER ENROLLMENT ROUTE
   =========================================================== */
router.post("/enroll-second-semester", uploadGradeSlip, async (req, res) => {
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();

    const { lrn, firstname, lastname } = req.body;
    const gradeSlipUrl = req.file?.path || null;

    // 🔍 Validate required fields
    if (!lrn || !firstname || !lastname) {
      return res.status(400).json({ 
        success: false, 
        message: "LRN, first name, and last name are required." 
      });
    }

    // 🔍 Verify student exists and is active
    const [students] = await conn.query(
      `SELECT * FROM student_details 
       WHERE LRN = ? AND firstname = ? AND lastname = ? AND is_active = 1`,
      [lrn, firstname, lastname]
    );

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found. Please check your information."
      });
    }

    const student = students[0];

    // 🔍 Check if already enrolled for 2nd semester
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    const school_year = `${currentYear}-${nextYear}`;

    const [existingEnrollments] = await conn.query(
      `SELECT * FROM student_enrollments 
       WHERE LRN = ? AND semester = '2nd' AND school_year = ?`,
      [lrn, school_year]
    );

    if (existingEnrollments.length > 0) {
      return res.status(400).json({
        success: false,
        message: "You are already enrolled for 2nd semester."
      });
    }

    // 🔍 Check if student completed 1st semester
    const [firstSemester] = await conn.query(
      `SELECT * FROM student_enrollments 
       WHERE LRN = ? AND semester = '1st' AND school_year = ? AND status = 'approved'`,
      [lrn, school_year]
    );

    if (firstSemester.length === 0) {
      return res.status(400).json({
        success: false,
        message: "You must complete 1st semester before enrolling for 2nd semester."
      });
    }

    // 🎓 Create 2nd semester enrollment record
    await conn.query(
      `INSERT INTO student_enrollments 
       (LRN, school_year, semester, status, grade_slip, enrollment_type, created_at) 
       VALUES (?, ?, '2nd', 'pending', ?, 'continuing', NOW())`,
      [lrn, school_year, gradeSlipUrl]
    );

    // 📈 Update student year level if progressing
    if (student.yearlevel === 'Grade 11') {
      await conn.query(
        `UPDATE student_details SET yearlevel = 'Grade 12' WHERE LRN = ?`,
        [lrn]
      );
    }

    // ✅ Commit transaction
    await conn.commit();

    // 📧 Send confirmation email
    try {
      await sendEnrollmentEmail(
        student.email,
        "🎓 2nd Semester Enrollment Confirmation - SVSHS",
        `
        <div style="font-family:'Segoe UI',Arial,sans-serif;line-height:1.6;color:#333;background-color:#f8fafc;padding:20px;">
          <div style="max-width:600px;background:#fff;margin:auto;border-radius:8px;box-shadow:0 4px 10px rgba(0,0,0,0.05);overflow:hidden;">
            <div style="background:#10b981;color:#fff;text-align:center;padding:20px;">
              <h2 style="margin:0;">2nd Semester Enrollment Confirmed</h2>
            </div>
            <div style="padding:25px;">
              <p>Dear <strong>${student.firstname} ${student.lastname}</strong>,</p>
              <p>Your enrollment for <strong>2nd Semester SY ${school_year}</strong> has been received!</p>
              
              <div style="background:#f0fdf4;border-left:4px solid #10b981;padding:15px;margin:20px 0;">
                <p style="margin:0;"><strong>Status:</strong> Pending (Waiting for grade slip verification)</p>
                <p style="margin:5px 0 0 0;"><strong>Enrollment Type:</strong> Continuing Student</p>
                <p style="margin:5px 0 0 0;"><strong>Year Level:</strong> ${student.yearlevel === 'Grade 11' ? 'Grade 12' : student.yearlevel}</p>
                <p style="margin:5px 0 0 0;"><strong>Strand:</strong> ${student.strand}</p>
              </div>

              <p>You can track your enrollment status using our mobile app.</p>

              <hr style="border:none;border-top:1px solid #e5e7eb;margin:30px 0;">
              <p style="font-size:0.9em;color:#666;">This is an automated message — please do not reply.</p>
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
      message: "Successfully enrolled for 2nd semester!",
      data: {
        lrn: student.lrn,
        name: `${student.firstname} ${student.lastname}`,
        yearlevel: student.yearlevel === 'Grade 11' ? 'Grade 12' : student.yearlevel,
        strand: student.strand,
        status: "pending"
      }
    });

  } catch (err) {
    await conn.rollback();
    console.error("❌ 2nd Semester Enrollment Error:", err);
    res.status(500).json({
      success: false,
      message: "An internal server error occurred during enrollment."
    });
  } finally {
    conn.release();
  }
});

export default router;