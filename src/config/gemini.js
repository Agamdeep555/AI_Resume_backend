import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config({ path: "./.env" });
console.log(
  "Gemini key loaded, length =",
  process.env.GEMINI_API_KEY?.length
);



const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);



export const model = genAI.getGenerativeModel({
  model: "gemini-3-flash-preview",
});
