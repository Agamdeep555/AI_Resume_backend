import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";
import resumeRoutes from "./routes/resume.routes.js";

const app = express();

connectDB();

app.use(cors({
  origin: "https://ai-resume-frontend-snowy.vercel.app",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
}));

app.use(express.json());

// ✅ API routes
app.use("/api/resume", resumeRoutes);

// ✅ REQUIRED for Vercel health check
app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "AI Resume Analyzer Backend",
  });
});

export default app;
