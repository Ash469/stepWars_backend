import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import authRoutes from "./routes/auth.js";
import {db,admin} from "./config/firebase.js"; 
import UserModel from "./models/user.js";
import battleRoutes from "./routes/battle.js";
import userRoutes from "./routes/user.js";
import cron from 'node-cron';
import notificationRoutes from './routes/notification.js';
import resetRoute from './routes/reset.js';
import mysteryBoxRoutes from './routes/mysteryBox.js';
import path from 'path';
import { fileURLToPath } from 'url'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(bodyParser.json());



app.use('/public', express.static(path.join(__dirname, '../public')));

// Routes
app.get("/", (req, res) => res.send("Welcome to StepWars Backend Alive 🚀"));
app.use("/auth", authRoutes);
app.use("/api/battle", battleRoutes);
app.use("/api/user",userRoutes);
app.use('/api/notifications', notificationRoutes); 
app.use('/api/daily-reset',resetRoute);
app.use('/api/mystery-box', mysteryBoxRoutes);

app.get("/sync-all-users", async (req, res) => {
  try {
    const usersSnapshot = await db.collection("users").get();

    if (usersSnapshot.empty) {
      return res.json({ message: "No users found in Firestore to sync." });
    }
    const bulkOps = usersSnapshot.docs.map(doc => {
      const firestoreData = doc.data();
      const dobAsDate = firestoreData.dob ? firestoreData.dob.toDate() : null;
      const mongoUpdateData = {
        uid: firestoreData.userId,
        email: firestoreData.email,
        username: firestoreData.username,
        dob: dobAsDate,
        gender: firestoreData.gender,
        weight: firestoreData.weight,
        height: firestoreData.height,
        contactNo: firestoreData.contactNo,
        profileImageUrl: firestoreData.profileImageUrl,
        stepGoal: firestoreData.stepGoal,
        todaysStepCount: firestoreData.todaysStepCount,
      };
      return {
        updateOne: {
          filter: { uid: firestoreData.userId }, 
          update: {
            $set: mongoUpdateData, 
            $setOnInsert: {     
                coins: 0,
                multipliers: {},
                rewards: {},
                stats: { battlesWon: 0, knockouts: 0, coinsWon: 0 }
            }
          },
          upsert: true 
        }
      };
    });
    const result = await UserModel.bulkWrite(bulkOps);
    res.json({
        message: "Bulk sync complete.",
        syncedUsers: result.upsertedCount + result.modifiedCount,
        newUsersCreated: result.upsertedCount,
        existingUsersUpdated: result.modifiedCount,
    });

  } catch (err) {
    console.error("Error during bulk sync:", err);
    res.status(500).json({ error: err.message });
  }
});

cron.schedule('0 0 * * *', () => {
  console.log('Triggering scheduled daily reset for IST midnight...');
  runDailyReset();
}, {
  scheduled: true,
  timezone: "Asia/Kolkata"
});

console.log("✔ Daily reset job scheduled for midnight IST.");

export default app;


