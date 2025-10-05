import UserModel from '../models/user.js';
import { db } from "../config/firebase.js";
import {updateDailyActivity} from "../utils/activityService.js"
import { handleDailyReset } from '../utils/resetService.js'; 
import DailyActivityModel from '../models/dailyActivity.js';
import { runDailyReset } from '../utils/dailyReset.js';


export const getUserProfile = async (req, res) => {
    try {
        const { uid } = req.params; 
        const { lastActivityDate } = req.query;
        if (!uid) {
            return res.status(400).json({ error: 'User UID is required.' });
        }
        await handleDailyReset(uid, lastActivityDate);
        const user = await UserModel.findOne({ uid: uid });
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.status(200).json(user);

    } catch (error) {
        console.error("Error fetching user profile:", error);
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
            .populate('rewards.Fort rewards.Monument rewards.Legend rewards.Badge');

        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

        res.status(200).json(user.rewards);

    } catch (error) {
        console.error("Error fetching user rewards:", error);
        res.status(500).json({ error: "An unexpected server error occurred." });
    }
};

export const triggerDailyReset = async (req, res) => {
  try {
    console.log('--- [MANUAL TRIGGER] Starting Daily Reset ---');
    await runDailyReset();
    console.log('--- [MANUAL TRIGGER] Daily Reset Finished ---');
    res.status(200).json({ success: true, message: "Manual daily reset completed successfully." });
  } catch (error) {
    console.error('[MANUAL TRIGGER] An error occurred:', error);
    res.status(500).json({ success: false, message: "Manual reset failed." });
  }
};

export const getActivityHistory = async (req, res) => {
  const { uid } = req.params;
  if (!uid) {
    return res.status(400).json({ error: "User UID is required." });
  }

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);

    const activities = await DailyActivityModel.find({
      uid: uid,
      date: { $gte: sevenDaysAgo }
    })
    .sort({ date: 'asc' }); 

    res.status(200).json(activities);

  } catch (error) {
    console.error("Error fetching activity history:", error);
    res.status(500).json({ error: "An unexpected server error occurred." });
  }
};
