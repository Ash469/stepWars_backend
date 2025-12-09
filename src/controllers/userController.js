import UserModel from '../models/user.js';
import { db } from "../config/firebase.js";
import DailyActivityModel from '../models/dailyActivity.js';
import moment from 'moment-timezone';

const getISTMidnightAsUTC = (dateInput) => {
    return moment(dateInput).tz('Asia/Kolkata').startOf('day').toDate();
};

export const handleDailyReset = async (user) => {
    const todayIST = moment().tz('Asia/Kolkata');
    const todayString = todayIST.format('YYYY-MM-DD');

    const lastActiveDate = user.lastActive || new Date(0);
    const lastActiveIST = moment(lastActiveDate).tz('Asia/Kolkata');
    const lastActiveString = lastActiveIST.format('YYYY-MM-DD');

    if (lastActiveString === todayString) {
        return null;
    }
    const archiveDate = lastActiveIST.startOf('day').toDate();

    console.log(`[Daily Reset - IST] Triggered for user ${user.uid}. Archiving for ${lastActiveString}. DB Timestamp: ${archiveDate.toISOString()}`);

    try {
        // Archive stats if there was any activity
        if ((user.todaysStepCount > 0) || (user.stats?.totalBattles > 0)) {
            await DailyActivityModel.findOneAndUpdate({
                uid: user.uid,
                'history.date': archiveDate // Check if record already exists for this exact timestamp
            }, {
                $set: {
                    // If record exists, update it (e.g. sync correction)
                    'history.$.stepCount': user.todaysStepCount || 0,
                    'history.$.battlesWon': user.stats?.battlesWon || 0,
                    'history.$.knockouts': user.stats?.knockouts || 0,
                    'history.$.totalBattles': user.stats?.totalBattles || 0,
                }
            }, {
            });
            const exists = await DailyActivityModel.findOne({ uid: user.uid, 'history.date': archiveDate });
            if (!exists) {
                await DailyActivityModel.findOneAndUpdate(
                    { uid: user.uid },
                    {
                        $push: {
                            history: {
                                $each: [{
                                    date: archiveDate,
                                    stepCount: user.todaysStepCount || 0
                                }],
                                $position: 0, // Add to top
                                $slice: 28    // Keep last 28 days
                            }
                        },
                        // Update lifetime stats
                        $inc: {
                            'lifetime.totalSteps': user.todaysStepCount || 0,
                            'lifetime.totalBattles': user.stats?.totalBattles || 0,
                            'lifetime.battlesWon': user.stats?.battlesWon || 0,
                            'lifetime.knockouts': user.stats?.knockouts || 0
                        }
                    },
                    { upsert: true }
                );
            }
        }

        // Reset User Data for the New Day
        const updatedUser = await UserModel.findOneAndUpdate({
            uid: user.uid
        }, {
            $set: {
                todaysStepCount: 0,
                'stats.battlesWon': 0,
                'stats.knockouts': 0,
                'stats.totalBattles': 0,
                lastActive: new Date() // Updates lastActive to NOW (UTC)
            }
        }, {
            new: true
        });

        console.log(`[Daily Reset] Reset complete for ${user.uid}. New Steps: ${updatedUser.todaysStepCount}`);
        return updatedUser;

    } catch (error) {
        console.error(`[Daily Reset] Error:`, error);
        return null;
    }
};

export const getUserProfile = async (req, res) => {
    try {
        const { uid } = req.params;
        if (!uid) return res.status(400).json({ error: 'User UID is required.' });

        // --- FIX: Use 'user' consistently ---
        let user = await UserModel.findOne({ uid: uid });
        if (!user) return res.status(404).json({ error: 'User not found.' });

        const resetUser = await handleDailyReset(user);
        if (resetUser) {
            user = resetUser; // Now 'user' is defined, so this works
        }

        res.status(200).json(user);

    } catch (error) {
        console.error("Error fetching profile:", error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const updateUserProfile = async (req, res) => {
    try {
        const { uid } = req.params;
        const { stats, rewards, multipliers, coins, ...updateData } = req.body;
        if (!uid) return res.status(400).json({ error: 'User UID is required.' });
        const updatedUser = await UserModel.findOneAndUpdate(
            { uid: uid },
            { $set: updateData },
            { new: true, upsert: true }
        );
        if (!updatedUser) return res.status(404).json({ error: 'User not found.' });
        res.status(200).json(updatedUser);
    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const syncUserSteps = async (req, res) => {
    try {
        const { uid, todaysStepCount } = req.body;
        if (!uid || todaysStepCount === undefined) return res.status(400).json({ error: 'Missing data' });

        const updatedUser = await UserModel.findOneAndUpdate(
            { uid: uid },
            { $set: { todaysStepCount: todaysStepCount } },
            { new: true }
        );
        if (!updatedUser) return res.status(404).json({ error: 'User not found' });
        res.status(200).json({ message: 'Synced', user: updatedUser });
    } catch (error) {
        console.error("Error syncing steps:", error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const getAllUsers = async (req, res) => {
    try {

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
    try {
        const doc = await DailyActivityModel.findOne({ uid: uid });
        res.status(200).json(doc ? doc.history : []);
    } catch (error) {
        console.error("Error fetching activity history:", error);
        res.status(500).json({ error: "Server error" });
    }
};

export const getLifetimeStats = async (req, res) => {
    const { uid } = req.params;
    try {
        const doc = await DailyActivityModel.findOne({ uid: uid });

        // Get stats or use defaults
        const stats = doc?.lifetime || {
            totalSteps: 0,
            totalBattles: 0,
            battlesWon: 0,
            knockouts: 0
        };

        const formattedStats = {
            _id: null,
            totalSteps: stats.totalSteps,
            totalBattles: stats.totalBattles,
            totalBattlesWon: stats.battlesWon,
            totalKnockouts: stats.knockouts
        };

        res.status(200).json(formattedStats);
    } catch (error) {
        console.error("Error fetching lifetime stats:", error);
        res.status(500).json({ error: "Server error" });
    }
};

export const syncPastSteps = async (req, res) => {
    const { uid, date, steps } = req.body; // date is "YYYY-MM-DD"

    if (!uid || !date || steps === undefined) {
        return res.status(400).json({ error: "UID, date, and steps required." });
    }

    try {
        const targetDateUTC = moment.tz(date, 'YYYY-MM-DD', 'Asia/Kolkata').startOf('day').toDate();
        console.log(`[Sync Past] Syncing ${steps} steps for ${uid} on ${date} (DB Time: ${targetDateUTC.toISOString()})`);
        const result = await DailyActivityModel.updateOne(
            { uid: uid, 'history.date': targetDateUTC },
            { $set: { 'history.$.stepCount': steps } }
        );
        if (result.matchedCount === 0) {
            console.log(`[Sync Past] Record missing. Creating new history entry.`);
            await DailyActivityModel.updateOne(
                { uid: uid },
                {
                    $push: {
                        history: {
                            $each: [{ date: targetDateUTC, stepCount: steps }],
                            $position: 0,
                            $slice: 28
                        }
                    },
                    $inc: { 'lifetime.totalSteps': steps } // Add these "missed" steps to lifetime
                },
                { upsert: true }
            );
        }
        res.status(200).json({ success: true });

    } catch (error) {
        console.error("[Sync Past] Error:", error);
        res.status(500).json({ error: "Failed to sync past steps." });
    }
};