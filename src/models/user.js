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
  coins: Number,
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
      Fort: [],
      Monument: [],
      Legend: [],
      Badge: []
    }
  },
  stats: Object
});

const UserModel = mongoose.model("User", userSchema);
export default UserModel;
