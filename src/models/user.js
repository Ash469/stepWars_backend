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
  multipliers: Object,
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
