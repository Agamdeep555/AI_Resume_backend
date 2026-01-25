import mongoose from "mongoose";

const resumeSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  resumeText: String,
  targetRole: String,
  geminiResult: Object,
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("ResumeAnalysis", resumeSchema);
