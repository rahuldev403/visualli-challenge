"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const mindmap_routes_1 = __importDefault(require("./routes/mindmap.routes"));
const errorHandler_1 = require("./middleware/errorHandler");
const provider_1 = require("./ai/provider");
function createApp() {
    const app = (0, express_1.default)();
    const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
    app.use((0, cors_1.default)({
        origin: (origin, callback) => !origin || allowedOrigins.includes(origin)
            ? callback(null, true)
            : callback(new Error("Not allowed by CORS")),
    }));
    app.use(express_1.default.json({ limit: "1mb" }));
    app.get("/api/health", (_req, res) => {
        res.json({ status: "ok", mockMode: (0, provider_1.isMockMode)() });
    });
    app.use("/api/mindmaps", mindmap_routes_1.default);
    app.use(errorHandler_1.notFoundHandler);
    app.use(errorHandler_1.errorHandler);
    return app;
}
