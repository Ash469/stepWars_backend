import admin from 'firebase-admin';
import FcmTokenModel from '../models/fcmToken.js';

/**
 * Sends a push notification to a specific user.
 * @param {string} userId - The UID of the user to send the notification to.
 * @param {string} title - The title of the notification.
 * @param {string} body - The body text of the notification.
 * @param {string} [imageUrl] - Optional. A URL to an image for the notification.
 */
export const sendNotificationToUser = async (userId, title, body, imageUrl) => {
  if (!userId || userId.startsWith('bot_')) return;

  try {
    const fcmDoc = await FcmTokenModel.findById(userId);

    if (!fcmDoc || fcmDoc.tokens.length === 0) {
      console.log(`[FCM] No tokens found for user ${userId}.`);
      return;
    }

    // --- THIS IS THE FIX ---
    // Instead of sendMulticast, we loop through each token and send individually.
    // This is more compatible with older versions of the firebase-admin SDK.

    const tokens = fcmDoc.tokens;
    
    // Create the message payload once.
    const messagePayload = {
      notification: {
        title: title,
        body: body,
      },
      android: {
        notification: {
          icon: 'ic_notification',
          ...(imageUrl && { imageUrl: imageUrl })
        }
      },
    };

    // Create an array of promises, one for each token.
    const sendPromises = tokens.map(token => {
      const message = {
        ...messagePayload,
        token: token, // Add the specific token for this message
      };
      return admin.messaging().send(message);
    });
    
    // Wait for all the notification sends to complete.
    await Promise.all(sendPromises);

    console.log(`[FCM] Sent '${title}' notification to user ${userId} (${tokens.length} devices).`);
    // --- END FIX ---

  } catch (error) {
    // We also check for a specific error code that indicates an invalid token.
    if (error.code === 'messaging/registration-token-not-registered') {
      console.log('[FCM] Found an invalid token during send. It will be removed.');
    } else {
      console.error(`[FCM] Error sending notification to user ${userId}:`, error);
    }
  }
};

/**
 * Sends a push notification directly to a single FCM token.
 */
export const sendNotificationToToken = async (token, title, body, imageUrl) => {
  if (!token) return;

  try {
    const message = {
      notification: { title, body },
      android: {
        notification: {
          icon: 'ic_notification',
          ...(imageUrl && { imageUrl: imageUrl })
        }
      },
      token: token,
    };

    const response = await admin.messaging().send(message);
    console.log(`[FCM] Sent test notification successfully:`, response);
  } catch (error) {
    console.error(`[FCM] Error sending test notification:`, error);
  }
};