import FcmTokenModel from "../models/fcmToken.js";
import UserModel from "../models/user.js";
import { sendNotificationToToken } from "../utils/notificationService.js";

export const registerFcmToken = async (req, res) => {
  const { uid, token } = req.body;

  if (!uid || !token) {
    return res.status(400).json({ error: "User UID and FCM token are required." });
  }

  try {
    const user = await UserModel.findOne({ uid: uid });
    if (!user) {
        return res.status(404).json({ error: "User not found." });
    }

    // --- MODIFICATION: Overwrite the token instead of adding to a set ---
    // This will create a new document if one doesn't exist, or update the
    // token field if it does.
    await FcmTokenModel.findByIdAndUpdate(
      uid,
      {
        $set: {
            user: uid,
            token: token // Set/overwrite the single token field
        }
      },
      { upsert: true, new: true }
    );

    console.log(`[FCM] Registered/Updated token for user ${uid}`);
    res.status(200).json({ message: "FCM token registered successfully." });

  } catch (error) {
    console.error("Error registering FCM token:", error);
    res.status(500).json({ error: "An unexpected server error occurred." });
  }
};

export const unregisterFcmToken = async (req, res) => {
  const { uid, token } = req.body;

  if (!uid || !token) {
    return res.status(400).json({ error: "User UID and FCM token are required." });
  }

  try {
    // --- MODIFICATION: Set the token to null instead of pulling from an array ---
    // This effectively logs the user out from notifications on that device
    // without affecting a potentially newer token from another device.
    await FcmTokenModel.updateOne(
      { _id: uid, token: token }, // Only update if the token matches
      { $set: { token: null } }
    );

    console.log(`[FCM] Unregistered token for user ${uid}`);
    res.status(200).json({ message: "FCM token unregistered successfully." });

  } catch (error)
  {
    console.error("Error unregistering FCM token:", error);
    res.status(500).json({ error: "An unexpected server error occurred." });
  }
};

export const sendTestNotification = async (req, res) => {
  const { token, title, body, imageUrl } = req.body;

  if (!token || !title || !body) {
    return res.status(400).json({ error: "A 'token', 'title', and 'body' are required." });
  }

  try {
    await sendNotificationToToken(token, title, body, imageUrl);
    res.status(200).json({ success: true, message: "Test notification sent." });
  } catch (error) {
    console.error("Error in sendTestNotification controller:", error);
    res.status(500).json({ success: false, error: "Failed to send test notification." });
  }
};
