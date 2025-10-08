import express from "express";
import { registerFcmToken,unregisterFcmToken  } from "../controllers/notificationController.js";

const router = express.Router();

router.post("/register-token", registerFcmToken);
router.post("/unregister-token", unregisterFcmToken);

export default router;