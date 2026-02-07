import mongoose from "mongoose";

const interestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

interestSchema.index({ isActive: 1, order: 1 });

const InterestModel = mongoose.model("Interest", interestSchema);

export default InterestModel;
