import "dotenv/config";
import { createApp } from "./app";
import { isMockMode } from "./ai/provider";

const PORT = Number(process.env.PORT) || 3001;

createApp().listen(PORT, () => {
  const mode = isMockMode()
    ? "MOCK_MODE (canned fixtures, no API key needed)"
    : `Gemini (${process.env.GEMINI_MODEL || "gemini-2.5-flash"})`;
  const strategy = process.env.GENERATION_MODE === "single" ? "single-pass" : "two-phase";

  console.log(`Backend listening on http://localhost:${PORT}`);
  console.log(`Provider:   ${mode}`);
  console.log(`Generation: ${strategy}`);
})
