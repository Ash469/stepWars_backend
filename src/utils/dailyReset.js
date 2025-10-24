import UserModel from '../models/user.js';
import DailyActivityModel from '../models/dailyActivity.js';

const getStartOfYesterdayUTC = () => {
  const now = new Date();
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  return yesterday;
};

export const runDailyReset = async () => {
  console.log('--- [CRON JOB] Starting Daily Reset for ALL users ---');
  const yesterday = getStartOfYesterdayUTC();

  try {
    // Fetch all users in the database
    const allUsers = await UserModel.find({});
    if (allUsers.length === 0) {
      console.log('[CRON JOB] No users found in DB.');
      return;
    }

    // Archive activity ONLY for users who had some steps or battles
    const activityPromises = allUsers.map(user => {
      if (user.todaysStepCount === 0 && user.stats.totalBattles === 0) return null;

      return DailyActivityModel.updateOne(
        { uid: user.uid, date: yesterday },
        {
          $set: {
            stepCount: user.todaysStepCount,
            battlesWon: user.stats.battlesWon,
            knockouts: user.stats.knockouts,
            totalBattles: user.stats.totalBattles,
          }
        },
        { upsert: true }
      );
    }).filter(Boolean);

    if (activityPromises.length > 0) {
      await Promise.all(activityPromises);
      console.log(`[CRON JOB] Archived activity for ${activityPromises.length} users.`);
    } else {
      console.log('[CRON JOB] No user activity to archive.');
    }

    // Reset all users' daily stats (regardless of activity)
    const resetResult = await UserModel.updateMany(
      {}, // <-- no filter: affects all users
      {
        $set: {
          todaysStepCount: 0,
          'stats.battlesWon': 0,
          'stats.knockouts': 0,
          'stats.totalBattles': 0,
        }
      }
    );

    console.log(`[CRON JOB] ✅ Reset stats for ${resetResult.modifiedCount} users.`);
    console.log('--- [CRON JOB] Finished ---');

  } catch (error) {
    console.error('[CRON JOB] ❌ Error during reset process:', error);
  }
};
