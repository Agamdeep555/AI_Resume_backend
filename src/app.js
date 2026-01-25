import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";

const app = express();

connectDB();

app.use(cors());
app.use(express.json());

// ✅ REQUIRED for Vercel health check
app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "AI Resume Analyzer Backend",
  });
});

import resumeRoutes from "./routes/resume.routes.js";
app.use("/api/resume", resumeRoutes);

export default app;
