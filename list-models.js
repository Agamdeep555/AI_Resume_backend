import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config({ path: "./.env" });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
  const models = await genAI.listModels(); 
  models.forEach(m => {
    console.log(m.name, "→ supports:", m.supportedGenerationMethods);
  });
}

listModels();
