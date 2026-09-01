import { Router } from "express";
import { MindmapController } from "../controllers/mindmap.controller";

const router = Router();

router.post("/", MindmapController.create);
router.post("/stream", MindmapController.createStream);
router.get("/", MindmapController.getAll);
router.get("/:id", MindmapController.getById);
router.post("/:id/expand", MindmapController.expand);

export default router;
