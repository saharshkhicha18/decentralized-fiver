import { Router } from "express";
import { authWorkerMiddleware } from "../middleware/auth";
import workerController from "../controllers/worker";

const router = Router();

router.post("/signin", workerController.signin)
router.get("/nextTask", authWorkerMiddleware, workerController.nextTask)

export default router;