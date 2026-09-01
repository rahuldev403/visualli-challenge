"use strict";
/**
 * Test environment defaults.
 *
 * MOCK_MODE keeps every test away from a real provider, and the memory store
 * keeps them from writing a JSON file next to the source.
 */
process.env.MOCK_MODE = "true";
process.env.MINDMAP_STORE = "memory";
delete process.env.GEMINI_API_KEY;
delete process.env.MOCK_FAIL_FIRST;
delete process.env.GENERATION_MODE;
