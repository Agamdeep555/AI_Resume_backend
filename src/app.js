import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";
import resumeRoutes from "./routes/resume.routes.js";

const app = express();

connectDB();

const allowedOrigins = [
  "https://ai-resume-frontend-snowy.vercel.app",
  "http://localhost:5173",
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (Postman, curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
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
