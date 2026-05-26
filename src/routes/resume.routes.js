import express from "express";
import multer from "multer";
import { createRequire } from "module";

import ResumeAnalysis from "../models/ResumeAnalysis.js";
import { cerebrasClient } from "../config/cerebras.js";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

const router = express.Router();
const upload = multer({storage: multer.memoryStorage() });

/**
 * Safely parse JSON returned by LLM
 */
function safeParseJSON(text) {
  try {
    const cleaned = text
      .replace(/```json|```/g, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    throw new Error("AI returned invalid JSON");
  }
}

router.post("/analyze", upload.single("resume"), async (req, res) => {
  try {
    const { targetRole, userId } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Resume PDF missing" });
    }

    const pdfData = await pdfParse(req.file.buffer);
    const resumeText = pdfData.text;

    const prompt = `
You are an ATS resume analyzer.

⚠️ IMPORTANT RULES:
- Respond with ONLY valid JSON
- No markdown
- No explanations
- No trailing commas
- Arrays must be comma-separated

Return JSON exactly in this format:
{
  "skills_found": string[],
  "missing_skills": string[],
  "improvement_suggestions": string[],
  "ats_score": number
}

Analyze the resume for the role of ${targetRole}.

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

    let parsed;
    try {
      parsed = safeParseJSON(rawText);
    } catch {
      return res.status(500).json({
        error: "Analysis failed",
        message: "AI response format error. Please try again.",
      });
    }

    // Save to DB (non-blocking for frontend UX)
    await ResumeAnalysis.create({
      userId,
      resumeText,
      targetRole,
      geminiResult: parsed,
    });

    // ✅ Return clean AI result to frontend
    res.status(200).json({
      ats_score: parsed.ats_score,
      skills_found: parsed.skills_found,
      missing_skills: parsed.missing_skills,
      improvement_suggestions: parsed.improvement_suggestions,
    });

  } catch (err) {
    console.error("ANALYSIS ERROR 👉", err.message);
    res.status(500).json({
      error: "Analysis failed",
      message: err.message,
    });
  }
});

export default router;
