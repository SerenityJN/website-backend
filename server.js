import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import studentRoutes from "./routes/studentRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import enrollmentRoutes from "./routes/enrollmentRoutes.js";
import secondSemesterRoutes from "./routes/secondSemesterRoutes.js";


const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration to allow your frontend to connect
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://sv8bshs.site",
      "https://enrollment.sv8bshs.site",
      "https://website-backend-lxwz.onrender.com",
    ],
    credentials: true,
  })
);


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure the 'uploads' directory exists
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Serve uploaded files statically from the '/uploads' route
app.use("/uploads", express.static(uploadDir));


// Mount the student enrollment routes
app.use("/api", studentRoutes);
app.use("/api/second-semester", secondSemesterRoutes);

app.use("/api", uploadRoutes);
app.use(enrollmentRoutes);

// A simple root route to confirm the backend is running
app.get("/", (req, res) => res.send("✅ Enrollment backend is running."));

app.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)

);
