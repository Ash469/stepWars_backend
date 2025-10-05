import DailyActivityModel from '../models/dailyActivity.js';


const getStartOfTodayUTC = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

export const updateDailyActivity = async (uid, updateData) => {
  if (!uid || !updateData) {
    console.error("[activityService] Missing uid or updateData.");
    return;
  }

  const today = getStartOfTodayUTC();

  try {
    await DailyActivityModel.findOneAndUpdate(
      { uid: uid, date: today }, 
      updateData,               
      { upsert: true, new: true, setDefaultsOnInsert: true } 
    );
  } catch (error) {
    console.error(`Error updating daily activity for user ${uid}:`, error);
  }
};