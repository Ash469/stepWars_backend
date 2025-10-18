import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();


// 1. Get the Base64 string from environment
const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT;

const serviceAccount = JSON.parse(
  Buffer.from(serviceAccountBase64, 'base64').toString('ascii')
);

// 3. Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DB_URL
});

const db = admin.firestore();
export { admin, db };
