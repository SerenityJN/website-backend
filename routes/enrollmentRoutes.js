import express from "express";
import db from "../models/db.js";

const router = express.Router();

router.get("/api/enrollment-status", async (req, res) => {
  const [rows] = await db.query("SELECT * FROM enrollment_settings LIMIT 1");
  const status = rows[0];

  const now = new Date();
  let isOpen = status.is_open;

  // Auto open/close by date range
  if (status.auto_start && status.auto_end) {
    if (now >= new Date(status.auto_start) && now <= new Date(status.auto_end)) {
      isOpen = true;
    } else if (now > new Date(status.auto_end)) {
      isOpen = false;
    }
  }

  res.json({ is_open: isOpen });
});

function verifyAdmin(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  next();
}

router.post("/api/toggle-enrollment", verifyAdmin, async (req, res) => {
  const { is_open } = req.body;
  await db.query("UPDATE enrollment_settings SET is_open = ?", [is_open]);
  res.json({
    success: true,
    message: `Enrollment is now ${is_open ? "OPEN" : "CLOSED"}`,
  });
});


router.post("/api/update-auto-schedule", verifyAdmin, async (req, res) => {
  const { auto_start, auto_end } = req.body;
  await db.query("UPDATE enrollment_settings SET auto_start = ?, auto_end = ?", [
    auto_start,
    auto_end,
  ]);
  res.json({
    success: true,
    message: "Automatic schedule updated successfully.",
  });
});

export default router;
