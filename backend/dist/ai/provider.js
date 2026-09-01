"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMockMode = void 0;
const isMockMode = () => process.env.MOCK_MODE === "true";
exports.isMockMode = isMockMode;
