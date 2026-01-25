import dotenv from "dotenv";
import app from "./app.js";
import connectDB from "./config/db.js";

dotenv.config({ path: "./.env" }); // ✅ FIRST

connectDB(); // ✅ AFTER dotenv

app.listen(5000, () => {
  console.log("Server running");
});
