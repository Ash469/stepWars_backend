import { admin } from '../config/firebase.js';
import FcmTokenModel from '../models/fcmToken.js';

export const sendNotificationToUser = async (userId, title, body, imageUrl) => {
  if (!userId || userId.startsWith('bot_')) return;

  try {
    const fcmDoc = await FcmTokenModel.findById(userId);
    if (!fcmDoc || !fcmDoc.tokens || fcmDoc.tokens.length === 0) {
      console.log(`[FCM] No tokens found for user ${userId}. Skipping notification.`);
      return;
    }

    const tokens = fcmDoc.tokens;

    // Create individual messages for each token
    const messages = tokens.map(token => ({
      notification: { title, body },
      android: {
        notification: {
          icon: 'ic_notification',
          ...(imageUrl && { imageUrl }),
        },
      },
      token: token,
    }));

    // Use sendEach or sendAll instead of sendMulticast
    const response = await admin.messaging().sendEach(messages);

    console.log(`[FCM] Sent to user ${userId}: ${response.successCount} successes, ${response.failureCount} failures.`);

    if (response.failureCount > 0) {
      const tokensToRemove = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`[FCM] Failure sending to token ${tokens[idx]}:`, resp.error);
          if (resp.error.code === 'messaging/registration-token-not-registered' ||
              resp.error.code === 'messaging/invalid-registration-token') {
            tokensToRemove.push(tokens[idx]);
          }
        }
      });

      if (tokensToRemove.length > 0) {
        console.log(`[FCM] Removing ${tokensToRemove.length} stale tokens for user ${userId}.`);
        await FcmTokenModel.updateOne(
          { _id: userId },
          { $pull: { tokens: { $in: tokensToRemove } } }
        );
      }
    }

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
    console.log(`[FCM] Sent single notification to token ${token}`);
  } catch (error) {
    if (error.code === 'messaging/registration-token-not-registered') {
        console.log(`[FCM] Test notification failed: Token ${token} is not registered.`);
    } else {
        console.error(`[FCM] Error sending single notification to ${token}:`, error);
    }
  }
};