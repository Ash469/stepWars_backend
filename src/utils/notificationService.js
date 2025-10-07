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
  if (!userId || userId.startsWith('bot_')) return; // Also ignore bots

  try {
    const fcmDoc = await FcmTokenModel.findById(userId);

    if (!fcmDoc || fcmDoc.tokens.length === 0) {
      console.log(`[FCM] No tokens found for user ${userId}.`);
      return;
    }

    // --- THIS IS THE NEW PART ---
    const message = {
      notification: {
        title: title,
        body: body,
      },
      android: {
        notification: {
          // This is your small, monochrome icon for the status bar
          icon: 'ic_notification', 
          // If an imageUrl is provided, add it to the payload
          ...(imageUrl && { imageUrl: imageUrl }) 
        }
      },
      tokens: fcmDoc.tokens,
    };
    // --- END NEW PART ---

    const response = await admin.messaging().sendMulticast(message);
    console.log(`[FCM] Sent '${title}' notification to user ${userId}. Success count:`, response.successCount);

  } catch (error) {
    console.error(`[FCM] Error sending notification to user ${userId}:`, error);
  }
};