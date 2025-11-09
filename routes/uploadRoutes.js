import express from "express";
import multer from "multer";
import ftp from "basic-ftp";
import path from "path";
import fs from "fs";
import db from "../config/db.js"; // adjust if your db file is in another folder

const router = express.Router();
const upload = multer({ dest: "temp_uploads/" }); // temporary local storage

router.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    // Connect to Hostinger FTP
    await client.access({
      host: "ftp://45.130.228.114", // change this to your real Hostinger FTP host
      user: "u937714947",       // your FTP username
      password: "09172004Jen!", // your FTP password
      secure: false, // use true if FTPS is required
    });

    const remotePath = `/public_html/enrollment/uploads/${req.file.originalname}`;
    const localPath = path.resolve(req.file.path);

    // Upload to Hostinger folder
    await client.uploadFrom(localPath, remotePath);

    // Construct the public URL
    const fileUrl = `https://enrollment.sv8bshs.com/uploads/${req.file.originalname}`;

    // Example: save to database
    await db.query(
      "UPDATE student_documents SET form137 = ? WHERE LRN = ?",
      [fileUrl, req.body.LRN]
    );

    // Optional: clean up temp file
    fs.unlink(localPath, () => {});

    res.json({ success: true, url: fileUrl });
  } catch (err) {
    console.error("FTP Upload Error:", err);
    res.status(500).json({ message: "Upload failed" });
  } finally {
    client.close();
  }
});

export default router;
