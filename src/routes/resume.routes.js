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

/**
 * Calculates the final ATS score using a weighted blend of:
 * - AI's raw role-match judgment (50%)
 * - Skill coverage ratio (30%)
 * - Role relevance score (20%)
 *
 * A hard relevance multiplier is applied when the role is fundamentally
 * mismatched (e.g. a Python dev applying for Blockchain Developer).
 * This drags the final score down proportionally, preventing inflated
 * scores from generic skill matches.
 */
function calculateATSScore(skillsFound, missingSkills, rawAIScore, roleRelevanceScore) {
  const totalSkills = skillsFound.length + missingSkills.length;

  // Skill coverage ratio (0–100): how many required skills the resume covers
  const skillCoverage =
    totalSkills === 0 ? 0 : Math.round((skillsFound.length / totalSkills) * 100);

  // Relevance multiplier: if role relevance is below 30, apply a hard penalty.
  // e.g. roleRelevanceScore = 10  → multiplier = 0.10  (90% penalty)
  //      roleRelevanceScore = 25  → multiplier = 0.25  (75% penalty)
  //      roleRelevanceScore = 50+ → multiplier = 1.00  (no penalty)
  const relevancePenalty = roleRelevanceScore < 30 ? roleRelevanceScore / 100 : 1;

  // Weighted blend before penalty
  const blended = Math.round(
    rawAIScore * 0.5 +
    skillCoverage * 0.3 +
    roleRelevanceScore * 0.2
  );

  // Apply the hard mismatch penalty and clamp to [0, 100]
  const final = Math.round(blended * relevancePenalty);
  return Math.max(0, Math.min(100, final));
}

router.post("/analyze", upload.single("resume"), async (req, res) => {
  try {
    const { targetRole, userId } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Resume PDF missing" });
    }

    // ── 1. Parse PDF ──────────────────────────────────────────────────────────
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

    // ── 2. Build prompt ───────────────────────────────────────────────────────
    const prompt = `You are a strict ATS resume scoring system. Output ONLY a single valid JSON object. No text before or after. No markdown. No code blocks. No explanations.

REQUIRED OUTPUT FORMAT (copy exactly):
{"skills_found":[],"missing_skills":[],"improvement_suggestions":[],"raw_ats_score":0,"role_relevance_score":0}

Scoring rules:
- raw_ats_score: integer 0-100. How well the resume matches "${targetRole}" based on skills, keywords, and experience depth. Be STRICT and realistic:
    * A Python dev applying for Blockchain Developer → 10-20
    * A JS dev applying for Go Developer → 15-25
    * A Go dev applying for Go Developer → 75-90
    * A Blockchain dev applying for Blockchain Developer → 78-92
- role_relevance_score: integer 0-100. Measures ONLY whether the resume is fundamentally relevant to "${targetRole}". If zero core role-specific skills exist, this MUST be 0-15. Examples:
    * No blockchain skills for a Blockchain Developer role → 5-15
    * No Go/systems skills for a Go Developer role → 10-20
    * Strong match for the exact role → 70-95
- skills_found: list of technologies/skills present in the resume that are directly relevant to "${targetRole}" only. Do NOT list generic skills that are not related to the role.
- missing_skills: list of critical skills expected for "${targetRole}" that are absent from the resume.
- improvement_suggestions: 3-5 specific, actionable suggestions to better tailor this resume for "${targetRole}".
- All array values must be strings only.
- No trailing commas. No extra fields.

Target Role: ${targetRole}
Resume Text:
${resumeText}
JSON:`;

    // ── 3. Call Cerebras API ──────────────────────────────────────────────────
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

    // ── 4. Parse AI response ──────────────────────────────────────────────────
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

    // Validate required fields exist and are the right types
    const skillsFound = Array.isArray(parsed.skills_found) ? parsed.skills_found : [];
    const missingSkills = Array.isArray(parsed.missing_skills) ? parsed.missing_skills : [];
    const suggestions = Array.isArray(parsed.improvement_suggestions)
      ? parsed.improvement_suggestions
      : [];
    const rawAIScore = typeof parsed.raw_ats_score === "number" ? parsed.raw_ats_score : 0;
    const roleRelevanceScore =
      typeof parsed.role_relevance_score === "number" ? parsed.role_relevance_score : 0;

    // ── 5. Compute final ATS score ────────────────────────────────────────────
    const finalScore = calculateATSScore(
      skillsFound,
      missingSkills,
      rawAIScore,
      roleRelevanceScore
    );

    // ── 6. Persist to DB (non-fatal) ──────────────────────────────────────────
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

    // ── 7. Respond ────────────────────────────────────────────────────────────
    return res.status(200).json({
      ats_score: finalScore,
      skills_found: skillsFound,
      missing_skills: missingSkills,
      improvement_suggestions: suggestions,
    });
  } catch (err) {
    console.error("ANALYSIS ERROR:", err.message);
    return res.status(500).json({
      error: "Analysis failed",
      message: err.message,
    });
  }
});

export default router;
