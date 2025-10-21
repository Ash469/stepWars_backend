import mongoose from "mongoose";

const fcmTokenSchema = new mongoose.Schema({
  _id: { type: String, required: true },

  user: { 
    type: String, 
    ref: 'User', 
    required: true 
  },
  token: { type: String, default: null } 
}, {
  _id: false, 
  timestamps: true 
});

const FcmTokenModel = mongoose.model("FcmToken", fcmTokenSchema);

export default FcmTokenModel;