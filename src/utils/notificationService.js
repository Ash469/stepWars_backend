import { admin } from '../config/firebase.js';
import FcmTokenModel from '../models/fcmToken.js';

export const sendNotificationToUser = async (userId, title, body, imageUrl) => {
  if (!userId || userId.startsWith('bot_')) return;

  try {
    const fcmDoc = await FcmTokenModel.findById(userId);
    if (!fcmDoc || !fcmDoc.token) {
        console.log(`[FCM] No valid token found for user ${userId}. Skipping notification.`);
        return;
    }

    const token = fcmDoc.token;

    const message = {
      notification: { title, body },
      android: {
        notification: {
          icon: 'ic_notification',
          ...(imageUrl && { imageUrl }),
        },
      },
      token: token,
    };

    await admin.messaging().send(message);
    console.log(`[FCM] Successfully sent notification to user ${userId}`);

  } catch (error) {
    if (error.code === 'messaging/registration-token-not-registered') {
        console.log(`[FCM] Stale token identified for user ${userId}. Removing it.`);
        await FcmTokenModel.updateOne({ _id: userId }, { $set: { token: null } });
    } else {
        console.error(`[FCM] Broader error sending notification to user ${userId}:`, error);
    }
  }
};

export const sendNotificationToToken = async (token, title, body, imageUrl) => {
  if (!token) return;
  try {
    const message = {
      notification: { title, body },
      android: {
        notification: {
          icon: 'ic_notification',
          ...(imageUrl && { imageUrl }),
        },
      },
      token: token,
    };
    await admin.messaging().send(message);
  } catch (error) {
    console.error(`[FCM] Error sending test notification:`, error);
  }
};
