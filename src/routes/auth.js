import express from "express";
import { syncUser,sendOtp,verifyOtp} from "../controllers/authController.js";

const router = express.Router();

// POST /auth/sync-user -> sync single user from Firestore to MongoDB
router.post("/sync-user", syncUser);
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);

export default router;

