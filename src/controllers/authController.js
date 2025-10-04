import { db } from "../config/firebase.js";
import UserModel from "../models/user.js";
import sendEmail from "../utils/mail.js";
import admin from "firebase-admin";

const otpStore = {};

export const syncUser = async (req, res) => {
  const { uid, email } = req.body;

  if (!uid) {
    return res.status(400).json({ error: "uid is required" });
  }

  try {
    const firestoreRef = db.collection("users").doc(uid);
    const firestoreDoc = await firestoreRef.get();
    if (firestoreDoc.exists) {
      const firestoreData = firestoreDoc.data();
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
      const mongoUser = await UserModel.findOneAndUpdate(
        { uid: uid },
        { 
          $set: mongoUpdateData, 
          $setOnInsert: {
              coins: 0,
              multipliers: {},
              rewards: {},
              stats: { battlesWon: 0, knockouts: 0, totalBattles: 0 }
          }
        },
        { upsert: true, new: true }
      );
      
      return res.json({ message: "User profile synced to MongoDB", user: mongoUser });
    } 
    
    // Case 2: User NOT in Firestore (they just signed up but haven't completed the profile)
    else {
      await UserModel.findOneAndUpdate(
          { uid: uid },
          { 
            $setOnInsert: {
              uid: uid,
              email: email,
              coins: 0,
              multipliers: {},
              rewards: {},
              stats: { battlesWon: 0, knockouts: 0, totalBattles: 0 }
            }
          },
          { upsert: true, new: true }
      );

      return res.status(201).json({ message: "Minimal user record created in MongoDB" });
    }

  } catch (err) {
    console.error("Error in syncUser:", err);
    res.status(500).json({ error: "Failed to sync user data" });
  }
};


export const sendOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    otpStore[email] = { otp, expiresAt };

    // Send OTP via reusable email function
    await sendEmail({
      to: email,
      subject: "Your StepWars OTP",
      text: `Your OTP for StepWars login is: ${otp}. It expires in 5 minutes.`,
      html: `<p>Your OTP for <b>StepWars</b> login is: <b>${otp}</b>. It expires in 5 minutes.</p>`
    });

    res.json({ message: "OTP sent to email" });
  } catch (err) {
    console.error("Error sending OTP:", err);
    res.status(500).json({ error: "Failed to send OTP" });
  }
};

export const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: "Email & OTP are required" });

  const record = otpStore[email];
  if (!record || record.otp !== otp || record.expiresAt < Date.now()) {
    if (record && record.expiresAt < Date.now()) {
      delete otpStore[email];
      return res.status(400).json({ error: "OTP expired" });
    }
    return res.status(400).json({ error: "Invalid OTP" });
  }

  try {
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        userRecord = await admin.auth().createUser({ email: email });
      } else {
        throw error;
      }
    }

    const customToken = await admin.auth().createCustomToken(userRecord.uid);
    delete otpStore[email]; 
    res.json({ message: "OTP verified successfully", token: customToken });

  } catch (err) {
    console.error("Error during custom token creation:", err);
    res.status(500).json({ error: "Failed to authenticate user" });
  }
};



