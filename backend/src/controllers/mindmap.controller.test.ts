import request from "supertest";
import express from "express";
import mindmapRoutes from "../routes/mindmap.routes";

const app = express();
app.use(express.json());
app.use("/api/mindmaps", mindmapRoutes);

describe("Mindmap API Endpoints", () => {
  it("POST /api/mindmaps returns 400 for empty text", async () => {
    const res = await request(app).post("/api/mindmaps").send({ text: "" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/provide at least 20 characters/);
  });
});
