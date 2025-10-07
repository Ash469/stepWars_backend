import UserModel from '../models/user.js';
import DailyActivityModel from '../models/dailyActivity.js';

const getStartOfYesterdayUTC = () => {
  const now = new Date();
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  return yesterday;
};

export const runDailyReset = async () => {
  console.log('--- [CRON JOB] Starting Daily Reset for all users ---');
  const yesterday = getStartOfYesterdayUTC();

  try {
    const usersToReset = await UserModel.find({
      $or: [
        { todaysStepCount: { $gt: 0 } },
        { 'stats.totalBattles': { $gt: 0 } }
      ]
    });

    if (usersToReset.length === 0) {
      console.log('[CRON JOB] No users needed a reset.');
      return;
    }
    const activityPromises = usersToReset.map(user => {
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
    }).filter(p => p !== null);

    if (activityPromises.length > 0) {
      await Promise.all(activityPromises);
      console.log(`[CRON JOB] Successfully archived activity for ${activityPromises.length} users.`);
    }
    const userIdsToReset = usersToReset.map(u => u.uid);
    const resetResult = await UserModel.updateMany(
      { uid: { $in: userIdsToReset } },
      {
        $set: {
          todaysStepCount: 0,
          'stats.battlesWon': 0,
          'stats.knockouts': 0,
          'stats.totalBattles': 0,
        }
      }
    );

    console.log(`[CRON JOB] Successfully reset stats for ${resetResult.modifiedCount} users.`);
    console.log('--- [CRON JOB] Finished ---');

  } catch (error) {
    console.error('[CRON JOB] An error occurred during the reset process:', error);
  }
};