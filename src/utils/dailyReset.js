import UserModel from '../models/user.js';
import DailyActivityModel from '../models/dailyActivity.js';
import moment from 'moment-timezone'; 

const getStartOfPreviousDayIST_UTC = () => {
  const nowIST = moment.tz('Asia/Kolkata');
  const yesterdayISTString = nowIST.subtract(1, 'day').format('YYYY-MM-DD');
  const startOfYesterdayIST = moment.tz(yesterdayISTString, 'YYYY-MM-DD', 'Asia/Kolkata');
  return startOfYesterdayIST.utc().toDate();
};

export const runDailyReset = async () => {
  console.log('--- [CRON JOB] Starting Lifetime + Minimal History Reset ---');
  
  const dateToArchive = getStartOfPreviousDayIST_UTC();
  const allUsers = await UserModel.find({});

  if (allUsers.length === 0) return;

  const activityPromises = allUsers.map(user => {
    const todaysSteps = user.todaysStepCount ?? 0;
    const totalBattles = user.stats?.totalBattles ?? 0;
    const battlesWon = user.stats?.battlesWon ?? 0;
    const knockouts = user.stats?.knockouts ?? 0;

    return DailyActivityModel.findOneAndUpdate(
      { uid: user.uid },
      {
        // 1. Increment Lifetime Stats
        $inc: {
          'lifetime.totalSteps': todaysSteps,
          'lifetime.totalBattles': totalBattles,
          'lifetime.battlesWon': battlesWon,
          'lifetime.knockouts': knockouts
        },
        // 2. Push to History (Keep max 28)
        $push: {
          history: {
            $each: [{ 
              date: dateToArchive, 
              stepCount: todaysSteps 
            }], 
            $position: 0, // Add to front (newest first)
            $slice: 28   // Keep only the newest 28
          }
        }
      },
      { upsert: true }
    );
  }).filter(Boolean);

  if (activityPromises.length > 0) {
    await Promise.all(activityPromises);
  }

  // Reset User Daily Stats
  await UserModel.updateMany({}, {
    $set: {
      todaysStepCount: 0,
      'stats.battlesWon': 0,
      'stats.knockouts': 0,
      'stats.totalBattles': 0,
      lastActive: new Date()
    }
  });

  console.log(`--- [CRON JOB] Finished processing ${activityPromises.length} users ---`);
};