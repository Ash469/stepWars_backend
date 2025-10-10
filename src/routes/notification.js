import express from "express";
import { registerFcmToken,unregisterFcmToken,sendTestNotification  } from "../controllers/notificationController.js";

const router = express.Router();

router.post("/register-token", registerFcmToken);
router.post("/unregister-token", unregisterFcmToken);
router.post("/send-test",sendTestNotification);

export default router;