import express from 'express';
import { openBox } from '../controllers/mysteryBoxController.js';
import { actionLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Route will be POST /api/mystery-box/open
router.post('/open', actionLimiter, openBox);

export default router;