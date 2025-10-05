import UserModel  from '../models/user.js';
import DailyActivityModel from '../models/dailyActivity.js';

/**
 * A utility function to get the start of the current day in UTC.
 * @returns {Date} The date object set to the beginning of today (00:00:00 UTC).
 */
const getStartOfTodayUTC = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

/**
 * Archives and resets daily stats.
 * If a uid is provided, it runs for a single user.
 * If no uid is provided, it runs for all active users.
 * @param {string} [uid] - Optional. The UID of a specific user to reset.
 */
export const runDailyReset = async (uid) => {
  console.log(`--- [Daily Reset] Starting for ${uid ? `user ${uid}` : 'all active users'} ---`);
  const today = getStartOfTodayUTC();
  
  try {
    // If a specific user is targeted, create a query filter for them.
    // Otherwise, find all users who have played at least one battle.
    const filter = uid ? { uid: uid } : { 'stats.totalBattles': { $gt: 0 } };

    const activeUsers = await UserModel.find(filter);
    if (activeUsers.length === 0) {
      console.log('[Daily Reset] No users found to process.');
      return;
    }

    // Archive the final stats for each found user.
    const activityPromises = activeUsers.map(user => {
      return DailyActivityModel.updateOne(
        { uid: user.uid, date: today },
        {
          $set: {
            stepCount: user.todaysStepCount,
            battlesWon: user.stats.battlesWon,
            knockouts: user.stats.knockouts,
            totalBattles: user.stats.totalBattles,
          }
        },
        { upsert: true } // Creates the document if it doesn't exist for that day
      );
    });
    
    await Promise.all(activityPromises);
    console.log(`[Daily Reset] Successfully archived activity for ${activeUsers.length} users.`);

    // Now, reset the daily stats only for the user(s) we just processed.
    const resetResult = await UserModel.updateMany(
      filter,
      {
        $set: {
          todaysStepCount: 0,
          'stats.battlesWon': 0,
          'stats.knockouts': 0,
          'stats.totalBattles': 0,
        }
      }
    );

    console.log(`[Daily Reset] Successfully reset stats for ${resetResult.modifiedCount} users.`);
    console.log('--- [Daily Reset] Finished ---');

  } catch (error) {
    console.error('[Daily Reset] An error occurred during the reset process:', error);
    // Throw the error so the manual trigger can catch it and send a failure response
    throw error;
  }
};