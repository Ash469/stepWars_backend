import mongoose from "mongoose";

const dailyActivitySchema = new mongoose.Schema({
  uid: { 
    type: String, 
    required: true, 
    unique: true, 
    ref: 'User', 
    index: true 
  },
  
  // 1. LIFETIME STATS (The Accumulator).
  lifetime: {
    totalSteps: { type: Number, default: 0 },
    totalBattles: { type: Number, default: 0 },
    battlesWon: { type: Number, default: 0 },
    knockouts: { type: Number, default: 0 },
  },

  // 2. MINIMAL HISTORY (Rolling 28 Days)
  history: [{
    date: { type: Date, required: true },
    stepCount: { type: Number, default: 0 }
  }]
}, {
  timestamps: true 
});

const DailyActivityModel = mongoose.model("DailyActivity", dailyActivitySchema);
export default DailyActivityModel;