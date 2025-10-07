import express from 'express';
import {triggerDailyReset} from '../controllers/resetController.js';
const router = express.Router();

router.post('/', triggerDailyReset);

export default router;