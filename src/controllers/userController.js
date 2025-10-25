import UserModel from '../models/user.js';
import { db } from "../config/firebase.js"; // Keep if needed for other functions
import DailyActivityModel from '../models/dailyActivity.js';

// --- ADDED handleDailyReset function code here ---
export const handleDailyReset = async (user) => {
    const getDateStringInIndia = (date) => {
        // Ensure date is valid before formatting
        if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
            console.error("[Daily Reset] Invalid date passed to getDateStringInIndia:", date);
            // Fallback to current date or handle as needed
            date = new Date();
        }
        return new Intl.DateTimeFormat('en-CA', { // 'en-CA' gives YYYY-MM-DD format
            timeZone: 'Asia/Kolkata', // Use IST timezone
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(date);
    };

    const getStartOfDayUTC = (date) => {
        // Ensure date is valid
         if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
            console.error("[Daily Reset] Invalid date passed to getStartOfDayUTC:", date);
            // Fallback to current date or handle as needed
            date = new Date();
         }
        const d = new Date(date);
        d.setUTCHours(0, 0, 0, 0); // Set hours, minutes, seconds, ms to 0 UTC
        return d;
    };

    const todayIndiaString = getDateStringInIndia(new Date());
    const lastActiveDate = user.lastActive || new Date(0); // Use epoch if lastActive is null/undefined
    const lastActiveIndiaString = getDateStringInIndia(lastActiveDate);


    if (lastActiveIndiaString === todayIndiaString) {
         console.log(`[Daily Reset - Check] Not needed for user ${user.uid}. Already active today (${todayIndiaString}).`);
        return null; // Return null if no reset happened
    }

    const archiveDate = getStartOfDayUTC(lastActiveDate); // Archive based on the ACTUAL last active date
    console.log(`[Daily Reset - IST] Triggered for user ${user.uid}. Archiving stats for ${lastActiveIndiaString}`);

    try {
        // Archive the previous day's stats only if there were steps or battles
        if (user.todaysStepCount > 0 || user.stats?.totalBattles > 0) {
            await DailyActivityModel.findOneAndUpdate({
                uid: user.uid,
                date: archiveDate // Use the calculated archive date
            }, {
                $set: {
                    stepCount: user.todaysStepCount || 0, // Ensure defaults
                    battlesWon: user.stats?.battlesWon || 0,
                    knockouts: user.stats?.knockouts || 0,
                    totalBattles: user.stats?.totalBattles || 0,
                }
            }, {
                upsert: true,
                setDefaultsOnInsert: true
            });
             console.log(`[Daily Reset - Archive] Archived activity for ${user.uid} on ${archiveDate.toISOString()}`);
        } else {
             console.log(`[Daily Reset - Archive] No activity to archive for ${user.uid} on ${archiveDate.toISOString()}`);
        }


        // Reset the user's daily stats AND update the lastActive timestamp
        const updatedUser = await UserModel.findOneAndUpdate({
            uid: user.uid
        }, {
            $set: {
                todaysStepCount: 0,
                'stats.battlesWon': 0,
                'stats.knockouts': 0,
                'stats.totalBattles': 0,
                lastActive: new Date() // Set lastActive to NOW
            }
        }, {
            new: true // Return the UPDATED document
        });

        console.log(`[Daily Reset - Done] Successfully reset stats for user ${user.uid}. New step count: ${updatedUser?.todaysStepCount}`);
        return updatedUser; // Return the user object with 0 steps

    } catch (error) {
        console.error(`[Daily Reset - IST] An error occurred during reset/archive for user ${user.uid}:`, error);
        return null; // Return null on error
    }
};
// --- END handleDailyReset function code ---


export const getUserProfile = async (req, res) => {
    try {
        const { uid } = req.params;
        if (!uid) {
            return res.status(400).json({ error: 'User UID is required.' });
        }

        // Fetch the user initially only to pass it to the reset check
        let initialUserCheck = await UserModel.findOne({ uid: uid });
        if (!initialUserCheck) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Attempt the daily reset. This function handles the DB update internally.
        // We await its completion to ensure updates happen before the final fetch.
        await handleDailyReset(initialUserCheck);

        // --- CRITICAL: Re-fetch the user AFTER the reset attempt ---
        const finalUser = await UserModel.findOne({ uid: uid });
        if (!finalUser) {
             console.error(`[getUserProfile] CRITICAL ERROR: User ${uid} disappeared after reset check.`);
             return res.status(404).json({ error: 'User data inconsistent after reset check.' });
        }

        console.log(`[getUserProfile] Final user state being sent. Steps: ${finalUser.todaysStepCount}`);

        res.status(200).json(finalUser); // Always return the freshly fetched user

    } catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).json({ error: 'An unexpected server error occurred.' });
    }
};

export const updateUserProfile = async (req, res) => {
    try {
        const { uid } = req.params;
        const { email, stats, rewards, multipliers, coins, ...updateData } = req.body;

        if (!uid) {
            return res.status(400).json({ error: 'User UID is required.' });
        }

        const updatedUser = await UserModel.findOneAndUpdate(
            { uid: uid },
            { $set: updateData },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found.' });
        }

        console.log(`[updateUserProfile] Successfully updated profile for user ${uid}`);
        res.status(200).json(updatedUser);

    } catch (error) {
        console.error("Error updating user profile:", error);
        res.status(500).json({ error: 'An unexpected server error occurred.' });
    }
};

export const syncUserSteps = async (req, res) => {
    try {
        const { uid, todaysStepCount } = req.body;
        if (!uid || todaysStepCount === undefined) {
            return res.status(400).json({ error: 'User UID and todaysStepCount are required.' });
        }
        const updatedUser = await UserModel.findOneAndUpdate(
            { uid: uid },
            { $set: { todaysStepCount: todaysStepCount } },
            { new: true }
        );
        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.status(200).json({ message: 'Step count synced successfully.', user: updatedUser });

    } catch (error) {
        console.error("Error syncing user steps:", error);
        res.status(500).json({ error: 'An unexpected server error occurred.' });
    }
};

// This function seems unused by the app and reads from Firestore - consider removing or migrating if needed
export const getAllUsers = async (req, res) => {
  try {
    // *** WARNING: Reads ALL users from FIRESTORE - potentially expensive ***
    const usersSnapshot = await db.collection("users").get();
    const users = usersSnapshot.docs.map(doc => doc.data());
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getUserRewards = async (req, res) => {
    const { uid } = req.params;
    if (!uid) {
        return res.status(400).json({ error: "User UID is required." });
    }

    try {
        const user = await UserModel.findOne({ uid: uid })
            .populate('rewards.Fort rewards.Monument rewards.Legend rewards.Badge'); // Populate reward details

        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

        res.status(200).json(user.rewards);

    } catch (error) {
        console.error("Error fetching user rewards:", error);
        res.status(500).json({ error: "An unexpected server error occurred." });
    }
};


export const getActivityHistory = async (req, res) => {
  const { uid } = req.params;
  if (!uid) {
    return res.status(400).json({ error: "User UID is required." });
  }

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7); // Get start of 7 days ago UTC
    sevenDaysAgo.setUTCHours(0, 0, 0, 0); // Set to midnight UTC

    const activities = await DailyActivityModel.find({
      uid: uid,
      date: { $gte: sevenDaysAgo } // Query activities from the last 7 days (UTC midnight)
    })
    .sort({ date: 'asc' }); // Sort by date ascending

    res.status(200).json(activities);

  } catch (error) {
    console.error("Error fetching activity history:", error);
    res.status(500).json({ error: "An unexpected server error occurred." });
  }
};

