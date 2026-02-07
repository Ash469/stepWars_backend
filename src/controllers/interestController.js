import InterestModel from "../models/interest.js";

export const getInterests = async (req, res) => {
  try {
    const interests = await InterestModel.find({ isActive: true }).sort({ order: 1 });
    res.json({ success: true, interests });
  } catch (error) {
    console.error("Error fetching interests:", error);
    res.status(500).json({ success: false, message: "Failed to fetch interests" });
  }
};
