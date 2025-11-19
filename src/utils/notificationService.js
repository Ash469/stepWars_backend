import { admin } from '../config/firebase.js';
import FcmTokenModel from '../models/fcmToken.js';

export const sendNotificationToUser = async (userId, title, body, imageUrl) => {
  if (!userId || userId.startsWith('bot_')) {
       return;
  }

  try {
    const fcmDoc = await FcmTokenModel.findById(userId);

    if (!fcmDoc || !fcmDoc.token) {
      // console.log(`[NOTIFICATION DEBUG] No valid token found in DB for user ${userId}. Skipping notification.`);
      return;
    }

    const token = fcmDoc.token;
    // console.log(`[NOTIFICATION DEBUG] Found token for user ${userId}: ${token}`);

    const message = {
      notification: { title, body },
      android: {
        priority: 'high', // <-- SET HIGH PRIORITY FOR ANDROID
        notification: {
          icon: 'ic_notification',
          ...(imageUrl && { imageUrl }),
          priority: 'high', // <-- Can also set here, redundancy is okay
        },
      },
       apns: { // <-- SET HIGH PRIORITY FOR IOS (APNS)
         headers: {
           'apns-priority': '10', // 10 is high, 5 is normal
         },
         payload: {
           aps: {
              // 'content-available': 1, // Use if you need background processing, maybe not needed here
              sound: 'default' // Ensure sound plays
           }
         }
       },
      token: token,
    };

    // console.log(`[NOTIFICATION DEBUG] Attempting to send message via send() to token: ${token}`);
    await admin.messaging().send(message);
    // console.log(`[NOTIFICATION DEBUG] Successfully sent message via send() to user ${userId} (token: ${token})`);

  } catch (error) {
    // console.error(`[NOTIFICATION DEBUG] Error during send() for user ${userId}:`, error);
    if (error.code === 'messaging/registration-token-not-registered' || error.code === 'messaging/invalid-registration-token') {
      // console.log(`[NOTIFICATION DEBUG] Stale token identified for user ${userId}. Removing it from DB.`);
      try {
        await FcmTokenModel.updateOne({ _id: userId }, { $set: { token: null } });
        // console.log(`[NOTIFICATION DEBUG] Successfully nulled token for user ${userId}.`);
      } catch (dbError) {
         // console.error(`[NOTIFICATION DEBUG] Failed to null token for user ${userId} after send error:`, dbError);
      }
    } else {
      // console.error(`[NOTIFICATION DEBUG] Broader error sending notification to user ${userId}:`, error);
    }
  }
};


export const sendNotificationToToken = async (token, title, body, imageUrl) => {
    // console.log(`[NOTIFICATION DEBUG] sendNotificationToToken called for token: ${token}`);
  if (!token) {
      //  console.log(`[NOTIFICATION DEBUG] Skipping test notification, no token provided.`);
       return;
    }
  try {
    const message = {
      notification: { title, body },
       android: {
        priority: 'high', // <-- SET HIGH PRIORITY FOR ANDROID
        notification: {
          icon: 'ic_notification',
          ...(imageUrl && { imageUrl }),
          priority: 'high',
        },
      },
       apns: { // <-- SET HIGH PRIORITY FOR IOS (APNS)
         headers: {
           'apns-priority': '10',
         },
         payload: {
           aps: {
             sound: 'default'
           }
         }
       },
      token: token,
    };
    //  console.log(`[NOTIFICATION DEBUG] Attempting to send test message via send() to token: ${token}`);
    await admin.messaging().send(message);
    //  console.log(`[NOTIFICATION DEBUG] Successfully sent test message via send() to token: ${token}`);
  } catch (error) {
    //  console.error(`[NOTIFICATION DEBUG] Error sending test notification to token ${token}:`, error);
    if (error.code === 'messaging/registration-token-not-registered') {
        // console.log(`[NOTIFICATION DEBUG] Test notification failed: Token ${token} is not registered.`);
    } else {
        // console.error(`[NOTIFICATION DEBUG] Error sending single notification to ${token}:`, error);
    }
  }
};

