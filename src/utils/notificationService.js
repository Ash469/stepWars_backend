import admin from 'firebase-admin';
import FcmTokenModel from '../models/fcmToken.js';

export const sendNotificationToUser = async (userId, title, body, imageUrl) => {
  if (!userId || userId.startsWith('bot_')) return;

  try {
    const fcmDoc = await FcmTokenModel.findById(userId);
    if (!fcmDoc || fcmDoc.tokens.length === 0) return;

    const messagePayload = {
      notification: { title, body },
      android: {
        notification: {
          icon: 'ic_notification',
          ...(imageUrl && { imageUrl }),
        },
      },
    };

    const tokens = fcmDoc.tokens;
    const sendPromises = tokens.map(token => {
      const message = { ...messagePayload, token };
      return admin.messaging().send(message).catch(error => {
        // --- THIS IS THE FIX ---
        // If an error occurs for a specific token, check if it's an "unregistered" error.
        // If so, return the invalid token so we can remove it later.
        if (error.code === 'messaging/registration-token-not-registered') {
          console.log(`[FCM] Stale token identified for removal: ${token}`);
          return { error: true, tokenToRemove: token };
        }
        // For other errors, just log them.
        console.error(`[FCM] Error sending to a token:`, error);
        return null;
      });
    });

    const results = await Promise.all(sendPromises);

    // --- NEW: Filter out the invalid tokens and remove them from the database ---
    const tokensToRemove = results
      .filter(result => result && result.error === true)
      .map(result => result.tokenToRemove);

    if (tokensToRemove.length > 0) {
      console.log(`[FCM] Removing ${tokensToRemove.length} stale token(s) for user ${userId}.`);
      await FcmTokenModel.updateOne(
        { _id: userId },
        { $pullAll: { tokens: tokensToRemove } }
      );
    }
    // --- END FIX ---

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