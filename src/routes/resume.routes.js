import express from "express";
import multer from "multer";

import { createRequire } from "module";
const require = createRequire(import.meta.url);

const pdfParse = require("pdf-parse");

console.log("pdfParse type:", typeof pdfParse);

import { model } from "../config/gemini.js";
import ResumeAnalysis from "../models/ResumeAnalysis.js";

const router = express.Router();
const upload = multer();

router.post("/analyze", upload.single("resume"), async (req, res) => {
  try {
    const { targetRole, userId } = req.body;

    const data = await pdfParse(req.file.buffer);
    const resumeText = data.text;

    const prompt = `
You are an ATS resume analyzer.
Analyze the following resume for the role of ${targetRole}.

Return JSON with:
skills_found
missing_skills
improvement_suggestions
ats_score (0-100)

Resume:
${resumeText}
`;

    const result = await model.generateContent(prompt);
    console.log("Gemini raw response:\n", result.response.text());
    const responseText = result.response.text();

    const parsed = JSON.parse(
      responseText.replace(/```json|```/g, "")
    );

    const saved = await ResumeAnalysis.create({
      userId,
      resumeText,
      targetRole,
      geminiResult: parsed,
    });

    res.json(saved);
  } catch (err) {
  console.error("ANALYSIS ERROR 👉", err);
  res.status(500).json({
    error: "Analysis failed",
    message: err.message
  });
}

});

export default router;
