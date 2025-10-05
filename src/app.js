import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import authRoutes from "./routes/auth.js";
import {db,admin} from "./config/firebase.js"; 
import UserModel from "./models/user.js";
import battleRoutes from "./routes/battle.js";
import userRoutes from "./routes/user.js";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Routes
app.get("/", (req, res) => res.send("StepWars Backend Alive 🚀"));
app.use("/auth", authRoutes);
app.use("/api/battle", battleRoutes);
app.use("/api/user",userRoutes);

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

export default app;


