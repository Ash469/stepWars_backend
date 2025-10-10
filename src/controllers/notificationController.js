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
    await FcmTokenModel.findByIdAndUpdate(
      uid,
      {
        $addToSet: { tokens: token }, // $addToSet prevents duplicates
        $set: {
            user: uid,
        }
      },
      { upsert: true, new: true }
    );

    console.log(`[FCM] Registered token for user ${uid}`);
    res.status(200).json({ message: "FCM token registered successfully." });

  } catch (error) {
    console.error("Error registering FCM token:", error);
    res.status(500).json({ error: "An unexpected server error occurred." });
  }
};

// --- NEW FUNCTION ---
export const unregisterFcmToken = async (req, res) => {
  const { uid, token } = req.body;

  if (!uid || !token) {
    return res.status(400).json({ error: "User UID and FCM token are required." });
  }

  try {
    // Use $pull to remove the specific token from the tokens array
    await FcmTokenModel.updateOne(
      { _id: uid },
      { $pull: { tokens: token } }
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
  // Add imageUrl to the destructured request body
  const { token, title, body, imageUrl } = req.body;

  if (!token || !title || !body) {
    return res.status(400).json({ error: "A 'token', 'title', and 'body' are required." });
  }

  try {
    // Pass the imageUrl to the service function
    await sendNotificationToToken(token, title, body, imageUrl);
    res.status(200).json({ success: true, message: "Test notification sent." });
  } catch (error) {
    console.error("Error in sendTestNotification controller:", error);
    res.status(500).json({ success: false, error: "Failed to send test notification." });
  }
};