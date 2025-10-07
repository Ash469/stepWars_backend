import FcmTokenModel from "../models/fcmToken.js";
import UserModel from "../models/user.js"; 

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
        $addToSet: { tokens: token },
        $set: {
            user: uid,
            username: user.username,
            email: user.email,
            contactNo: user.contactNo
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