import admin from 'firebase-admin';
import FcmTokenModel from '../models/fcmToken.js';

export const sendNotificationToUser = async (userId, title, body, imageUrl) => {
  if (!userId || userId.startsWith('bot_')) return;

  try {
    const fcmDoc = await FcmTokenModel.findById(userId);
    // Ensure the user has tokens registered.
    if (!fcmDoc || fcmDoc.tokens.length === 0) {
        console.log(`[FCM] No tokens found for user ${userId}. Skipping notification.`);
        return;
    }

    // ✨ FIXED: Get only the last token from the array.
    const latestToken = fcmDoc.tokens[fcmDoc.tokens.length - 1];

    const message = {
      notification: { title, body },
      android: {
        notification: {
          icon: 'ic_notification',
          ...(imageUrl && { imageUrl }),
        },
      },
      token: latestToken, 
    };

    // Send the message and handle potential errors for that single token.
    await admin.messaging().send(message).catch(async (error) => {
        if (error.code === 'messaging/registration-token-not-registered') {
            console.log(`[FCM] Stale token ${latestToken} identified for removal.`);
            // If the token is bad, remove it from the database.
            await FcmTokenModel.updateOne(
                { _id: userId },
                { $pull: { tokens: latestToken } }
            );
        } else {
            console.error(`[FCM] Error sending to token ${latestToken}:`, error);
        }
    });

  } catch (error) {
    console.error(`[FCM] Broader error sending notification to user ${userId}:`, error);
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