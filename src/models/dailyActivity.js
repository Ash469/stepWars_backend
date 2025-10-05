import mongoose from "mongoose";

const dailyActivitySchema = new mongoose.Schema({
  // Link to the user
  uid: { 
    type: String, 
    required: true,
    ref: 'User',
    index: true
  },
  date: { 
    type: Date, 
    required: true 
  },
  stepCount: { 
    type: Number, 
    default: 0 
  },
  battlesWon: { 
    type: Number, 
    default: 0 
  },
  knockouts: { 
    type: Number, 
    default: 0 
  },
  totalBattles: { 
    type: Number, 
    default: 0 
  },
  coinsEarned: { 
    type: Number, 
    default: 0 
  },
  rewardsUnlocked: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reward'
  }]
}, {
  timestamps: true 
});

dailyActivitySchema.index({ uid: 1, date: 1 }, { unique: true });

const DailyActivityModel = mongoose.model("DailyActivity", dailyActivitySchema);

export default DailyActivityModel;