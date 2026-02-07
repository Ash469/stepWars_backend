import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  uid: { type: String, unique: true },
  email: String,
  username: String,
  dob: Object,
  gender: String,
  weight: Number,
  height: Number,
  contactNo: String,
  profileImageUrl: String,
  stepGoal: Number,
  todaysStepCount: Number,
  coins: { type: Number, default: 0 },
  multipliers: {
    type: Map,
    of: Number,
    default: {
      '1_5x': 0,
      '2x': 0,
      '3x': 0
    }
  },
  rewards: {
    type: Map,
    of: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reward'
    }],
    default: {
      Forts: [],
      Crests: [],
      Icons: [],
      Badges: []
    }
  },
   stats: {
    type: {
      battlesWon: { type: Number, default: 0 },
      knockouts: { type: Number, default: 0 },
      totalBattles: { type: Number, default: 0 },
    },
    default: () => ({ battlesWon: 0, knockouts: 0, totalBattles: 0 })
  },
  lastActive: { type: Date, default: Date.now },
  mysteryBoxLastOpened: {
    type: Map,
    of: Date,
    default: {}
  },

  interestAreas: { type: [String], default: [] },
  avgDailySteps: { type: String, default: null }

});

const UserModel = mongoose.model("User", userSchema);
export default UserModel;
