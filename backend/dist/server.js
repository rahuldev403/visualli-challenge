"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const app_1 = require("./app");
const provider_1 = require("./ai/provider");
const PORT = Number(process.env.PORT) || 3001;
(0, app_1.createApp)().listen(PORT, () => {
    const mode = (0, provider_1.isMockMode)()
        ? "MOCK_MODE (canned fixtures, no API key needed)"
        : `Gemini (${process.env.GEMINI_MODEL || "gemini-3.6-flash"})`;
    const strategy = process.env.GENERATION_MODE === "single" ? "single-pass" : "two-phase";
    console.log(`Backend listening on http://localhost:${PORT}`);
    console.log(`Provider:   ${mode}`);
    console.log(`Generation: ${strategy}`);
});
