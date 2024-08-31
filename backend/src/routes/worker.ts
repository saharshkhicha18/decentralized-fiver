import { Router } from "express";
import { authWorkerMiddleware } from "../middleware/auth";
import workerController from "../controllers/worker";

const router = Router();

router.post("/signin", workerController.signin)
router.get("/nextTask", authWorkerMiddleware, workerController.nextTask)
router.post("/submission", authWorkerMiddleware, workerController.submission)
router.get("/balance", authWorkerMiddleware, workerController.balance)
router.post("/payout", authWorkerMiddleware, workerController.payout)

export default router;