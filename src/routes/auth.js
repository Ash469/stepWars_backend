import express from "express";
import { syncUser,sendOtp,verifyOtp} from "../controllers/authController.js";
import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post("/sync-user", syncUser);
router.post("/send-otp", authLimiter, sendOtp);
router.post("/verify-otp", authLimiter, verifyOtp);

export default router;

