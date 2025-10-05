// utils/resetService.js

import UserModel from '../models/user.js';
import DailyActivityModel from '../models/dailyActivity.js';

/**
 * Checks if a daily reset is needed and performs it.
 * This is now the single source of truth for the reset logic.
 * @param {Document} user - The full Mongoose user document.
 * @returns {Promise<Document|null>} The updated user document if a reset occurred, otherwise null.
 */
export const handleDailyReset = async (user) => {
    // Helper function to get the start of a day in UTC
    const getStartOfDayUTC = (date) => {
        const d = new Date(date);
        d.setUTCHours(0, 0, 0, 0);
        return d;
    };

    const today = getStartOfDayUTC(new Date());
    const lastActiveDate = getStartOfDayUTC(user.lastActive || new Date());

    // If the last active date is today, no reset is needed. Exit immediately.
    if (lastActiveDate.getTime() === today.getTime()) {
        return null;
    }

    console.log(`[Daily Reset] Triggered for user ${user.uid}. Archiving stats for ${lastActiveDate.toISOString().split('T')[0]}`);

    try {
        // 1. Archive the previous day's stats
        await DailyActivityModel.findOneAndUpdate({
            uid: user.uid,
            date: lastActiveDate
        }, {
            $set: {
                stepCount: user.todaysStepCount,
                battlesWon: user.stats.battlesWon,
                knockouts: user.stats.knockouts,
                totalBattles: user.stats.totalBattles,
            }
        }, {
            upsert: true,
            setDefaultsOnInsert: true
        });

        // 2. Reset the user's daily stats AND update the lastActive timestamp
        const updatedUser = await UserModel.findOneAndUpdate({
            uid: user.uid
        }, {
            $set: {
                todaysStepCount: 0,
                'stats.battlesWon': 0,
                'stats.knockouts': 0,
                'stats.totalBattles': 0,
                lastActive: new Date() // <-- THE CRITICAL "STAMP"
            }
        }, {
            new: true // Return the updated document
        });

        console.log(`[Daily Reset] Successfully archived and reset stats for user ${user.uid}.`);
        return updatedUser;

    } catch (error) {
        console.error(`[Daily Reset] An error occurred for user ${user.uid}:`, error);
        return null;
    }
};