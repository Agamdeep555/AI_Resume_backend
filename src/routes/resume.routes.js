import express from "express";
import multer from "multer";
import { createRequire } from "module";
import ResumeAnalysis from "../models/ResumeAnalysis.js";
import { cerebrasClient } from "../config/cerebras.js";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function safeParseJSON(text) {
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    throw new Error("AI returned invalid JSON");
  }
}

/**
 * Counts how many times each keyword from the target role appears in the
 * resume text (case-insensitive). Returns a density score 0–100 based on
 * how many unique keywords hit at least once, weighted by frequency.
 */
function calculateKeywordDensity(resumeText, skillsFound) {
  if (!skillsFound.length) return { score: 0, breakdown: [] };

  const lowerText = resumeText.toLowerCase();
  const breakdown = skillsFound.map((skill) => {
    const regex = new RegExp(skill.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    const count = (lowerText.match(regex) || []).length;
    return { skill, count };
  });

  // Skills mentioned 3+ times are "well reinforced"; score rewards repetition up to a cap
  const totalMentions = breakdown.reduce((sum, s) => sum + Math.min(s.count, 3), 0);
  const maxPossible = skillsFound.length * 3;
  const score = maxPossible === 0 ? 0 : Math.round((totalMentions / maxPossible) * 100);

  return { score, breakdown };
}

/**
 * Checks how complete the resume structure is. Looks for common sections
 * by keyword. Returns a completeness score 0–100 and a list of missing sections.
 */
function checkResumeCompleteness(resumeText) {
  const lower = resumeText.toLowerCase();

  const sections = [
    { name: "Professional Summary / Objective", keywords: ["summary", "objective", "profile", "about me"] },
    { name: "Work Experience",                  keywords: ["experience", "employment", "work history", "positions held"] },
    { name: "Education",                         keywords: ["education", "degree", "university", "college", "bachelor", "master", "phd"] },
    { name: "Skills",                            keywords: ["skills", "technologies", "tech stack", "competencies", "tools"] },
    { name: "Projects",                          keywords: ["projects", "portfolio", "built", "developed", "created"] },
    { name: "Certifications",                    keywords: ["certification", "certified", "certificate", "credential", "license"] },
    { name: "Quantified Achievements",           keywords: ["increased", "decreased", "reduced", "improved", "led", "managed", "%", "saved", "grew", "delivered"] },
    { name: "Contact Information",               keywords: ["email", "phone", "linkedin", "github", "portfolio", "@"] },
  ];

  const found = [];
  const missing = [];

  for (const section of sections) {
    const hit = section.keywords.some((kw) => lower.includes(kw));
    if (hit) found.push(section.name);
    else missing.push(section.name);
  }

  const score = Math.round((found.length / sections.length) * 100);
  return { score, found, missing };
}

/**
 * Final ATS score: weighted blend of 5 signals, with a hard role-relevance
 * multiplier that crushes scores when the resume is fundamentally mismatched.
 *
 * Weights:
 *   40% — AI raw role-match score
 *   20% — Role relevance (AI)
 *   15% — Skill coverage ratio
 *   15% — Keyword density (local)
 *   10% — Resume completeness (local)
 */
function calculateATSScore({
  skillsFound,
  missingSkills,
  rawAIScore,
  roleRelevanceScore,
  keywordDensityScore,
  completenessScore,
}) {
  const totalSkills = skillsFound.length + missingSkills.length;
  const skillCoverage =
    totalSkills === 0 ? 0 : Math.round((skillsFound.length / totalSkills) * 100);

  // Hard penalty for fundamental role mismatch
  const relevancePenalty = roleRelevanceScore < 30 ? roleRelevanceScore / 100 : 1;

  const blended = Math.round(
    rawAIScore        * 0.40 +
    roleRelevanceScore * 0.20 +
    skillCoverage     * 0.15 +
    keywordDensityScore * 0.15 +
    completenessScore * 0.10
  );

  const final = Math.round(blended * relevancePenalty);
  return Math.max(0, Math.min(100, final));
}

/**
 * Converts a numeric ATS score into a human-readable tier label and short
 * advice blurb, so the frontend can show contextual messaging.
 */
function getScoreTier(score) {
  if (score >= 80) return { tier: "Excellent",    color: "green",  message: "Strong match. Apply with confidence." };
  if (score >= 65) return { tier: "Good",          color: "blue",   message: "Solid match. A few tweaks will sharpen it." };
  if (score >= 45) return { tier: "Fair",          color: "yellow", message: "Partial match. Significant gaps need addressing." };
  if (score >= 25) return { tier: "Poor",          color: "orange", message: "Weak match. Major reskilling or retargeting needed." };
  return           { tier: "Very Poor",            color: "red",    message: "Fundamental mismatch. This role requires different core skills." };
}

// ─────────────────────────────────────────────────────────────────────────────
// Route
// ─────────────────────────────────────────────────────────────────────────────

router.post("/analyze", upload.single("resume"), async (req, res) => {
  try {
    const { targetRole, userId } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Resume PDF missing" });
    }

    // ── 1. Parse PDF ────────────────────────────────────────────────────────
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

    // ── 2. Call AI ──────────────────────────────────────────────────────────
   const prompt = `You are a strict ATS resume scoring system. Output ONLY a single valid JSON object. No text before or after. No markdown. No code blocks. No explanations.

REQUIRED OUTPUT FORMAT (copy exactly):
{"skills_found":[],"missing_skills":[],"improvement_suggestions":[],"raw_ats_score":0,"role_relevance_score":0,"experience_level_fit":{"detected_level":"","required_level":"","fit_score":0,"reason":""},"competitor_benchmark":{"percentile":0,"summary":""}}

Field rules:
- raw_ats_score: integer 0-100. Score strictly based on how well the resume's actual skills, keywords, and experience match "${targetRole}". Do not give credit for unrelated skills.
- role_relevance_score: integer 0-100. Score ONLY whether the resume contains skills and experience that are core and fundamental to "${targetRole}". If the resume lacks the primary technical skills this role requires, score must be very low (0-20).
- skills_found: skills in the resume DIRECTLY relevant to "${targetRole}" only. Do not include generic or transferable skills unless they are specifically required for this role.
- missing_skills: critical skills that "${targetRole}" requires which are absent from the resume.
- improvement_suggestions: 3-5 specific, actionable suggestions to better tailor this resume for "${targetRole}".
- experience_level_fit:
    * detected_level: candidate's apparent seniority ("Junior", "Mid", "Senior", "Lead/Principal")
    * required_level: seniority this resume's experience aligns with for "${targetRole}"
    * fit_score: integer 0-100 (100 = perfect level match, lower = mismatch)
    * reason: one sentence explaining the level assessment
- competitor_benchmark:
    * percentile: integer 0-100 — where this resume ranks vs typical applicants for "${targetRole}"
    * summary: one sentence describing how competitive this resume is for the role
- All array values must be strings only.
- No trailing commas. No extra fields.

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
        max_tokens: 1500,
      });
    } catch (apiErr) {
      return res.status(500).json({
        error: "Cerebras API failed",
        message: apiErr.message,
      });
    }

    // ── 3. Parse AI response ─────────────────────────────────────────────────
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

    // Safe field extraction with fallbacks
    const skillsFound    = Array.isArray(parsed.skills_found)        ? parsed.skills_found        : [];
    const missingSkills  = Array.isArray(parsed.missing_skills)      ? parsed.missing_skills      : [];
    const suggestions    = Array.isArray(parsed.improvement_suggestions) ? parsed.improvement_suggestions : [];
    const rawAIScore     = typeof parsed.raw_ats_score    === "number" ? parsed.raw_ats_score    : 0;
    const roleRelevance  = typeof parsed.role_relevance_score === "number" ? parsed.role_relevance_score : 0;
    const expFit         = parsed.experience_level_fit    ?? { detected_level: "Unknown", required_level: "Unknown", fit_score: 0, reason: "" };
    const benchmark      = parsed.competitor_benchmark    ?? { percentile: 0, summary: "" };

    // ── 4. Local analysis signals ────────────────────────────────────────────
    const { score: keywordDensityScore, breakdown: keywordBreakdown } =
      calculateKeywordDensity(resumeText, skillsFound);

    const { score: completenessScore, found: sectionsFound, missing: sectionsMissing } =
      checkResumeCompleteness(resumeText);

    // ── 5. Final composite ATS score ─────────────────────────────────────────
    const finalScore = calculateATSScore({
      skillsFound,
      missingSkills,
      rawAIScore,
      roleRelevanceScore: roleRelevance,
      keywordDensityScore,
      completenessScore,
    });

    const scoreTier = getScoreTier(finalScore);

    // ── 6. Persist to DB (non-fatal) ─────────────────────────────────────────
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
      // Core
      ats_score:              finalScore,
      score_tier:             scoreTier,

      // Skills
      skills_found:           skillsFound,
      missing_skills:         missingSkills,
      improvement_suggestions: suggestions,

      // Sub-scores breakdown
      score_breakdown: {
        role_relevance:     roleRelevance,
        raw_ai_match:       rawAIScore,
        keyword_density:    keywordDensityScore,
        resume_completeness: completenessScore,
        experience_fit:     expFit.fit_score,
      },

      // Keyword density details
      keyword_density: {
        score:     keywordDensityScore,
        breakdown: keywordBreakdown,          // [{skill, count}]
      },

      // Resume completeness
      resume_completeness: {
        score:    completenessScore,
        present:  sectionsFound,
        missing:  sectionsMissing,
      },

      // Experience level fit
      experience_level_fit: {
        detected_level: expFit.detected_level,
        required_level: expFit.required_level,
        fit_score:      expFit.fit_score,
        reason:         expFit.reason,
      },

      // Competitive benchmark
      competitor_benchmark: {
        percentile: benchmark.percentile,
        summary:    benchmark.summary,
      },
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
