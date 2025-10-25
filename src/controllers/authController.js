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
    // --- MODIFICATION ---
    // This function NO LONGER syncs from Firestore.
    // It just ensures a minimal user record exists in MongoDB using
    // findOneAndUpdate with upsert:true.
    
    // $setOnInsert will only apply if a new document is created.
    // This is now safe to call multiple times without overwriting stats.
    const mongoUser = await UserModel.findOneAndUpdate(
      { uid: uid },
      { 
        $set: { email: email }, // Ensure email is up-to-date
        $setOnInsert: {
            uid: uid,
            email: email,
            coins: 0,
            multipliers: { '1_5x': 0, '2x': 0, '3x': 0 },
            rewards: { Fort: [], Monument: [], Legend: [], Badge: [] },
            stats: { battlesWon: 0, knockouts: 0, totalBattles: 0 },
            todaysStepCount: 0 // Default to 0 on insert
        }
      },
      { upsert: true, new: true } // 'new: true' returns the updated/created doc
    );
    
    return res.json({ message: "User upserted in MongoDB", user: mongoUser });

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



