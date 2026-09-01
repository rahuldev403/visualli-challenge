import { Router } from "express";
import { MindmapController } from "../controllers/mindmap.controller";

const router = Router();

router.post("/", MindmapController.create);
router.get("/", MindmapController.getAll);
router.get("/:id", MindmapController.getById);

export default router;
