
import UserModel from '../models/user.js';
import DailyActivityModel from '../models/dailyActivity.js';

export const handleDailyReset = async (user) => {
    const getDateStringInIndia = (date) => {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(date);
    };

    const getStartOfDayUTC = (date) => {
        const d = new Date(date);
        d.setUTCHours(0, 0, 0, 0);
        return d;
    };

    const todayIndiaString = getDateStringInIndia(new Date());
    const lastActiveIndiaString = getDateStringInIndia(user.lastActive || new Date());

    // --- THIS IS THE FIX ---
    // The old line was using variables 'lastActiveDate' and 'today' which are not defined.
    // The new line correctly compares the date strings we just created.
    if (lastActiveIndiaString === todayIndiaString) {
        return null;
    }

    const archiveDate = getStartOfDayUTC(user.lastActive);
    console.log(`[Daily Reset - IST] Triggered for user ${user.uid}. Archiving stats for ${lastActiveIndiaString}`);

    try {
        // Archive the previous day's stats
        await DailyActivityModel.findOneAndUpdate({
            uid: user.uid,
            date: archiveDate
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

        // Reset the user's daily stats AND update the lastActive timestamp
        const updatedUser = await UserModel.findOneAndUpdate({
            uid: user.uid
        }, {
            $set: {
                todaysStepCount: 0,
                'stats.battlesWon': 0,
                'stats.knockouts': 0,
                'stats.totalBattles': 0,
                lastActive: new Date()
            }
        }, {
            new: true
        });

        console.log(`[Daily Reset - IST] Successfully archived and reset stats for user ${user.uid}.`);
        return updatedUser;

    } catch (error) {
        console.error(`[Daily Reset - IST] An error occurred for user ${user.uid}:`, error);
        return null;
    }
};