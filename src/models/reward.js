import mongoose from "mongoose";

const rewardSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true, enum: ['Forts', 'Crests', 'Icons', 'Badges'], index: true },
  description: { type: String, default: 'A special reward earned in battle.' },
  tier: { type: String, required: true, enum: ['Rare', 'Epic', 'Mythic', 'Legendary'], index: true },
  imagePath: { type: String, required: true }
});

const RewardModel = mongoose.model("Reward", rewardSchema);


export default RewardModel;