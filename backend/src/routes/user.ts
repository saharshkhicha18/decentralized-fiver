import express from 'express';
import { authMiddleware } from '../middleware/auth';
import UserController from '../controllers/user'

const router = express.Router();

router.post('/signin', authMiddleware, UserController.signin)
router.get('/preSignedUrl', authMiddleware, UserController.preSignedUrl)
router.get('/task', authMiddleware, UserController.getTask)
router.post('/task', authMiddleware, UserController.createTask)

export default router
