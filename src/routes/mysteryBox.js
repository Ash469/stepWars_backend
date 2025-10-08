import express from 'express';
import { openBox } from '../controllers/mysteryBoxController.js';

const router = express.Router();

// Route will be POST /api/mystery-box/open
router.post('/open', openBox);

export default router;