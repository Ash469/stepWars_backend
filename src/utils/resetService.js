import UserModel  from '../models/user.js';
import DailyActivityModel from '../models/dailyActivity.js';

export const handleDailyReset = async (uid, lastActivityDateStr) => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const lastActivityDate = lastActivityDateStr ? new Date(lastActivityDateStr) : null;
  if (lastActivityDate) {
    lastActivityDate.setUTCHours(0, 0, 0, 0);
  }
  if (!lastActivityDate || lastActivityDate.getTime() === today.getTime()) {
    return; // Exit early, no reset needed.
  }

  console.log(`[Daily Reset] Triggered for user ${uid}. Archiving stats for ${lastActivityDate.toISOString().split('T')[0]}`);

  try {
    const user = await UserModel.findOne({ uid: uid });
    if (!user) {
      console.error(`[Daily Reset] User with uid ${uid} not found.`);
      return;
    }
    await DailyActivityModel.findOneAndUpdate(
      { uid: user.uid, date: lastActivityDate },
      {
        $set: {
          stepCount: user.todaysStepCount,
          battlesWon: user.stats.battlesWon,
          knockouts: user.stats.knockouts,
          totalBattles: user.stats.totalBattles,
        }
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
    await UserModel.updateOne(
      { uid: user.uid },
      {
        $set: {
          todaysStepCount: 0,
          'stats.battlesWon': 0,
          'stats.knockouts': 0,
          'stats.totalBattles': 0,
        }
      }
    );
    console.log(`[Daily Reset] Successfully archived and reset stats for user ${uid}.`);

  } catch (error) {
    console.error(`[Daily Reset] An error occurred for user ${uid}:`, error);
  }
};