import mongoose from "mongoose";

const rewardSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true, enum: ['Fort', 'Monument', 'Legend', 'Badge'] },
  tier: { type: String, required: true, enum: ['Rare', 'Epic', 'Mythic', 'Legendary'] },
  imagePath: { type: String, required: true }
});

const RewardModel = mongoose.model("Reward", rewardSchema);


export default RewardModel;