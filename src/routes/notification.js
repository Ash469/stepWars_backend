import express from "express";
import { registerFcmToken } from "../controllers/notificationController.js";

const router = express.Router();

router.post("/register-token", registerFcmToken);

export default router;