import mongoose from "mongoose";

const battleSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  player1Id: { type: String, required: true, ref: 'User', index: true },
  player2Id: { type: String, ref: 'User', index: true },
  gameType: { type: String, enum: ['BOT', 'FRIEND'], required: true },
  status: {
    type: String,
    enum: ['WAITING', 'ONGOING', 'COMPLETED', 'CANCELLED'],
    default: 'WAITING',
    index: true
  },
  winnerId: { type: String, ref: 'User', index: true },
  result: { type: String, enum: ['WIN', 'KO', 'DRAW', 'FORFEIT'] },
  player1FinalScore: { type: Number, default: 0 },
  player2FinalScore: { type: Number, default: 0 },
  rewards: {
    coins: { type: Number, default: 0 },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Reward', default: null }
  }, potentialReward: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reward', // This links it to your Reward model
    default: null
  },

},

  {
    timestamps: true,
    _id: false
  });

const BattleModel = mongoose.model("Battle", battleSchema);
export default BattleModel;
