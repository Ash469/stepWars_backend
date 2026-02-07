import mongoose from "mongoose";

const rewardSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true, enum: ['Forts', 'Crests', 'Icons', 'Badges'], index: true },
  interest: { type: String, required: true, trim: true, index: true },
  description: { type: String, default: 'A special reward earned in battle.' },
  tier: { type: String, required: true, enum: ['Rare', 'Epic', 'Mythic', 'Legendary'], index: true },
  imagePath: { type: String, required: true }
});

rewardSchema.index({ tier: 1, interest: 1 });

const RewardModel = mongoose.model("Reward", rewardSchema);


export default RewardModel;