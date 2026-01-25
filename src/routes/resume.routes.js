

// import { createRequire } from "module";
// const require = createRequire(import.meta.url);

// const pdfParse = require("pdf-parse");

// console.log("pdfParse type:", typeof pdfParse);

import express from "express";
import multer from "multer";

import { createRequire } from "module";

import ResumeAnalysis from "../models/ResumeAnalysis.js";
import { cerebrasClient } from "../config/cerebras.js";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
console.log("pdfParse type:", typeof pdfParse);

const router = express.Router();
const upload = multer();

router.post("/analyze", upload.single("resume"), async (req, res) => {
  try {
    const { targetRole, userId } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Resume PDF missing" });
    }

    const data = await pdfParse(req.file.buffer);
    console.log("CEREBRAS KEY length:", process.env.CEREBRAS_API_KEY?.length);
    const resumeText = data.text;

    const prompt = `
You are an ATS resume analyzer.

Analyze the resume for the role of ${targetRole}.
Return ONLY valid JSON with:
- skills_found (array)
- missing_skills (array)
- improvement_suggestions (array)
- ats_score (number 0-100)

Resume:
${resumeText}
`;

    const response = await cerebrasClient.post("/chat/completions", {
      model: "llama-3.3-70b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 1024,
    });

    const rawText = response.data.choices[0].message.content;

    const parsed = JSON.parse(
      rawText.replace(/```json|```/g, "")
    );

    const saved = await ResumeAnalysis.create({
  userId,
  resumeText,
  targetRole,
  geminiResult: parsed, // stored in DB
});

res.status(200).json({
  ats_score: parsed.ats_score,
  skills_found: parsed.skills_found,
  missing_skills: parsed.missing_skills,
  improvement_suggestions: parsed.improvement_suggestions,
});

  } catch (err) {
    console.error("ANALYSIS ERROR 👉", err.response?.data || err.message);
    res.status(500).json({
      error: "Analysis failed",
      message: err.response?.data || err.message,
    });
  }
});

export default router;
