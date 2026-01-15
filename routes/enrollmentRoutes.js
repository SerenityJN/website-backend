import express from "express";
import db from "../config/db.js"; // This should be your 'pg' Pool instance

const router = express.Router();

/* ===========================================================
   🎓 GET ENROLLMENT STATUS
   =========================================================== */
router.get("/api/enrollment-status", async (req, res) => {
  try {
    // MySQL: [rows] -> Postgres: { rows }
    const { rows } = await db.query("SELECT * FROM enrollment_settings LIMIT 1");
    
    if (rows.length === 0) {
      return res.status(404).json({ error: "Settings not found" });
    }

    const status = rows[0];
    const now = new Date();
    let isOpen = status.is_open;

    // Auto open/close by date range
    if (status.auto_start && status.auto_end) {
      const startDate = new Date(status.auto_start);
      const endDate = new Date(status.auto_end);

      if (now >= startDate && now <= endDate) {
        isOpen = true;
      } else if (now > endDate) {
        isOpen = false;
      }
    }

    res.json({ is_open: isOpen });
  } catch (err) {
    console.error("Error checking enrollment status:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ===========================================================
   🛡️ ADMIN VERIFICATION MIDDLEWARE
   =========================================================== */
function verifyAdmin(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  next();
}

/* ===========================================================
   🔧 TOGGLE ENROLLMENT MANUALLY
   =========================================================== */
router.post("/api/toggle-enrollment", verifyAdmin, async (req, res) => {
  try {
    const { is_open } = req.body;
    
    // MySQL: ? -> Postgres: $1
    await db.query("UPDATE enrollment_settings SET is_open = $1", [is_open]);
    
    res.json({
      success: true,
      message: `Enrollment is now ${is_open ? "OPEN" : "CLOSED"}`,
    });
  } catch (err) {
    console.error("Error toggling enrollment:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

/* ===========================================================
   📅 UPDATE AUTOMATIC SCHEDULE
   =========================================================== */
router.post("/api/update-auto-schedule", verifyAdmin, async (req, res) => {
  try {
    const { auto_start, auto_end } = req.body;
    
    // MySQL: ?, ? -> Postgres: $1, $2
    await db.query(
      "UPDATE enrollment_settings SET auto_start = $1, auto_end = $2", 
      [auto_start, auto_end]
    );
    
    res.json({
      success: true,
      message: "Automatic schedule updated successfully.",
    });
  } catch (err) {
    console.error("Error updating schedule:", err);
    res.status(500).json({ error: "Failed to update schedule" });
  }
});

export default router;
