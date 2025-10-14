import dotenv from "dotenv";
import app from "./src/app.js";
import connectDB from "./src/config/db.js";
import { admin } from "./src/config/firebase.js";


dotenv.config();

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
  // ensureDummyPlayerExists(); 
});

// //for testing PVP battles with a dummy player
// const ensureDummyPlayerExists = async () => {
//   const rtdb = admin.database();
//   const dummyPlayerRef = rtdb.ref('matchmakingPool/dummy_player_test_01');
  
//   const dummyPlayerData = {
//     uid: 'dummy_player_test_01',
//     username: 'Test Opponent',
//     status: 'waiting',
//     entryTime: 1
//   };  

//   await dummyPlayerRef.set(dummyPlayerData);
//   console.log("✔ Dummy player for testing is now available in the matchmaking pool.");
// };
