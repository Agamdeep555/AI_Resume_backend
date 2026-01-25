import axios from "axios";

export const cerebrasClient = axios.create({
  baseURL: "https://api.cerebras.ai/v1",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.CEREBRAS_API_KEY}`,
  },
});
