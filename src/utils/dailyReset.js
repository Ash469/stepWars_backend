import UserModel from '../models/user.js';
import DailyActivityModel from '../models/dailyActivity.js';
import moment from 'moment-timezone'; // Import moment-timezone


const getStartOfPreviousDayIST_UTC = () => {
 
  const nowIST = moment.tz('Asia/Kolkata');
 
  const yesterdayISTString = nowIST.subtract(1, 'day').format('YYYY-MM-DD');
 
  const startOfYesterdayIST = moment.tz(yesterdayISTString, 'YYYY-MM-DD', 'Asia/Kolkata');
 
  return startOfYesterdayIST.utc().toDate();
};

export const runDailyReset = async () => {
  console.log('--- [CRON JOB] Starting Daily Reset for ALL users ---');
  
  const dateToArchive = getStartOfPreviousDayIST_UTC();
 
  const dateToArchiveString = moment(dateToArchive).toISOString();

  console.log(`[CRON JOB] Archiving data for date (representing IST day that ended, stored as UTC): ${dateToArchiveString}`);

  try {
  
    const allUsers = await UserModel.find({});
    if (allUsers.length === 0) {
      console.log('[CRON JOB] No users found in DB.');
      return;
    }

    const activityPromises = allUsers.map(user => {
      const todaysSteps = user.todaysStepCount ?? 0;
      const totalBattles = user.stats?.totalBattles ?? 0;

      // Skip archiving if there was no activity
      if (todaysSteps === 0 && totalBattles === 0) {
         console.log(`[CRON JOB] Skipping archive for user ${user.uid} on ${dateToArchiveString} - no activity.`);
         return null; 
      }

      console.log(`[CRON JOB] Preparing archive for user ${user.uid} for date ${dateToArchiveString} with steps: ${todaysSteps}, battles: ${totalBattles}`);
      
      return DailyActivityModel.updateOne(
        { uid: user.uid, date: dateToArchive },
        {
          $set: {
            stepCount: todaysSteps,
            battlesWon: user.stats?.battlesWon ?? 0,
            knockouts: user.stats?.knockouts ?? 0,
            totalBattles: totalBattles,
          }
        },
        { upsert: true }
      );
    }).filter(Boolean); 

    // Execute all the archive operations
    if (activityPromises.length > 0) {
      await Promise.all(activityPromises);
      console.log(`[CRON JOB] Archived activity for ${activityPromises.length} users for date ${dateToArchiveString}.`);
    } else {
      console.log(`[CRON JOB] No user activity needed archiving for date ${dateToArchiveString}.`);
    }

    
    const resetResult = await UserModel.updateMany(
      {},
      {
        $set: {
          todaysStepCount: 0,
          'stats.battlesWon': 0,
          'stats.knockouts': 0,
          'stats.totalBattles': 0,
          lastActive: new Date()
        }
      }
    );

    console.log(`[CRON JOB] ✅ Reset daily stats for ${resetResult.modifiedCount} users.`);
    console.log('--- [CRON JOB] Finished ---');

  } catch (error) {
    console.error('[CRON JOB] ❌ Error during daily reset process:', error);
  }
};