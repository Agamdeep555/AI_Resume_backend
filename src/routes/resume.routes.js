import express from "express";
import multer from "multer";
import { createRequire } from "module";

import ResumeAnalysis from "../models/ResumeAnalysis.js";
import { cerebrasClient } from "../config/cerebras.js";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function safeParseJSON(text) {
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    throw new Error("AI returned invalid JSON");
  }
}
function calculateATSScore(skillsFound, missingSkills) {
  const total = skillsFound.length + missingSkills.length;
  if (total === 0) return 0;
  return Math.round((skillsFound.length / total) * 100);
}

router.post("/analyze", upload.single("resume"), async (req, res) => {
  try {
    const { targetRole, userId } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Resume PDF missing" });
    }

    let resumeText;
    try {
      const pdfData = await pdfParse(req.file.buffer);
      resumeText = pdfData.text;
    } catch (pdfErr) {
      return res.status(400).json({
        error: "PDF parse failed",
        message: pdfErr.message,
      });
    }

    const prompt = `You are a strict ATS resume scoring system. Output ONLY a single valid JSON object. No text before or after. No markdown. No code blocks. No explanations.

REQUIRED OUTPUT FORMAT (copy exactly):
{"skills_found":[],"missing_skills":[],"improvement_suggestions":[],"ats_score":0}

Rules:
- ats_score: integer 0-100
- skills_found: technologies/skills present in resume
- missing_skills: important skills for "${targetRole}" NOT in resume
- improvement_suggestions: 3-5 specific actionable fixes
- All arrays contain strings only
- No trailing commas
- No extra fields

Target Role: ${targetRole}

Resume Text:
${resumeText}

JSON:`;

    let response;
    try {
      response = await cerebrasClient.post("/chat/completions", {
        model: "llama3.1-8b",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 1024,
      });
    } catch (apiErr) {
      return res.status(500).json({
        error: "Cerebras API failed",
        message: apiErr.message,
      });
    }

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

    // Save to DB (non-fatal)
    try {
      await ResumeAnalysis.create({
        userId,
        resumeText,
        targetRole,
        geminiResult: parsed,
      });
    } catch (dbErr) {
      console.error("DB save failed (non-fatal):", dbErr.message);
    }

    res.status(200).json({
      ats_score: calculateATSScore(parsed.skills_found, parsed.missing_skills),
      skills_found: parsed.skills_found,
      missing_skills: parsed.missing_skills,
      improvement_suggestions: parsed.improvement_suggestions,
    });

  } catch (err) {
    console.error("ANALYSIS ERROR:", err.message);
    res.status(500).json({
      error: "Analysis failed",
      message: err.message,
    });
  }
});

export default router;
