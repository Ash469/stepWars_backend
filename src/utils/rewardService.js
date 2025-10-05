import  UserModel  from '../models/user.js';
import RewardModel from '../models/reward.js';
import { updateDailyActivity } from './activityService.js';

// Helper functions (selectTierByProbability, tiers array) should be at the top
const tiers = [
    { name: 'Legendary', weight: 1 },
    { name: 'Mythic', weight: 9 },
    { name: 'Epic', weight: 30 },
    { name: 'Rare', weight: 60 }
];
const totalWeight = 100;

function selectTierByProbability() {
    let randomNum = Math.random() * totalWeight;
    for (const tier of tiers) {
        if (randomNum < tier.weight) {
            return tier.name;
        }
        randomNum -= tier.weight;
    }
    return 'Rare';
}

/**
 * ✨ CORRECTED FUNCTION: Decides a potential reward WITHOUT granting it.
 * This is lightweight and safe to call at the start of a battle.
 * @param {string} userId - The ID of the player to check for duplicates against.
 * @returns {Promise<Object|null>} The potential reward document, or null.
 */
export const decidePotentialReward = async (userId) => {
  try {
    const user = await UserModel.findOne({ uid: userId });
    if (!user) throw new Error("User not found for reward decision.");

    const ownedRewardIds = new Set(
      Object.values(user.rewards.toObject()).flat().map(id => id.toString())
    );

    const initialTierName = selectTierByProbability();
    let tierIndex = tiers.findIndex(t => t.name === initialTierName);

    for (let i = tierIndex; i < tiers.length; i++) {
      const currentTier = tiers[i].name;
      const potentialRewards = await RewardModel.find({ tier: currentTier });
      const unownedRewards = potentialRewards.filter(
        reward => !ownedRewardIds.has(reward._id.toString())
      );

      if (unownedRewards.length > 0) {
        const randomIndex = Math.floor(Math.random() * unownedRewards.length);
        // Simply return the decided reward object. DO NOT SAVE ANYTHING.
        return unownedRewards[randomIndex];
      }
    }
    return null; // No new rewards are available for this user
  } catch (error) {
    console.error("Error deciding potential reward:", error);
    return null;
  }
};