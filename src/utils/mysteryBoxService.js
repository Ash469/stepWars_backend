import UserModel from "../models/user.js";
import RewardModel from "../models/reward.js";
import { getMysteryBoxCosts } from "../config/remoteConfigService.js";

const BOX_CONFIG = {
  bronze: {
    rewards: {
      coins: { chance: 40, minScale: 1.0, maxScale: 1.5 },
      multiplier: {
        chance: 30,
        types: [
          { type: "1_5x", chance: 70 },
          { type: "2x", chance: 25 },
          { type: "3x", chance: 5 },
        ],
      },
      collectible: {
        chance: 30,
        tiers: [
          { tier: "Rare", chance: 80 },
          { tier: "Epic", chance: 20 },
        ],
      },
    },
  },
  silver: {
    rewards: {
      coins: { chance: 35, minScale: 1.0, maxScale: 2.0 },
      multiplier: {
        chance: 25,
        types: [
          { type: "1_5x", chance: 50 },
          { type: "2x", chance: 35 },
          { type: "3x", chance: 15 },
        ],
      },
      collectible: {
        chance: 40,
        tiers: [
          { tier: "Rare", chance: 50 },
          { tier: "Epic", chance: 35 },
          { tier: "Mythic", chance: 15 },
        ],
      },
    },
  },
  gold: {
    rewards: {
      coins: { chance: 30, minScale: 1.0, maxScale: 3.0 },
      multiplier: {
        chance: 20,
        types: [
          { type: "1_5x", chance: 35 },
          { type: "2x", chance: 40 },
          { type: "3x", chance: 25 },
        ],
      },
      collectible: {
        chance: 50,
        tiers: [
          { tier: "Epic", chance: 40 },
          { tier: "Mythic", chance: 45 },
          { tier: "Legendary", chance: 15 },
        ],
      },
    },
  },
};

const selectWeightedRandom = (items) => {
  const totalWeight = items.reduce((sum, item) => sum + item.chance, 0);
  let random = Math.random() * totalWeight;
  for (const item of items) {
    if (random < item.chance) return item;
    random -= item.chance;
  }
  // Fallback in case of floating point issues, return the last item
  return items[items.length - 1];
};

export const openMysteryBox = async (userId, boxType) => {
  const DYNAMIC_PRICES = getMysteryBoxCosts();

  const user = await UserModel.findOne({ uid: userId });
  if (!user) throw new Error("User not found.");

  if (!user.multipliers) user.multipliers = new Map();
  if (!user.rewards) user.rewards = new Map();
  if (!user.mysteryBoxLastOpened) user.mysteryBoxLastOpened = new Map();

  let isZeroCoinSilver = false;

  if (user.coins === 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (user.zeroCoinSilverLastGiven) {
      const lastGiven = new Date(user.zeroCoinSilverLastGiven);
      lastGiven.setHours(0, 0, 0, 0);

      if (lastGiven.getTime() === today.getTime()) {
        throw new Error("Free silver box already given today.");
      }
    }

    boxType = "silver";
    isZeroCoinSilver = true;
    user.zeroCoinSilverLastGiven = new Date();
  }
  const price = DYNAMIC_PRICES[boxType];
  const box = BOX_CONFIG[boxType];
  if (!box) throw new Error("Invalid box type.");

  if (!isZeroCoinSilver) {
    if (user.coins < price) throw new Error("Not enough coins.");
    user.coins -= price;
  }

  user.mysteryBoxLastOpened.set(boxType, new Date());

  const rewardCategories = Object.keys(box.rewards).map((key) => ({
    type: key,
    chance: box.rewards[key].chance,
  }));
  let chosenCategoryItem = selectWeightedRandom(rewardCategories);

  // Handle potential undefined case from selectWeightedRandom
  if (!chosenCategoryItem) {
    console.error(`Error selecting reward category for ${boxType} box.`);
    const fallbackAmount = Math.floor(price / 4);
    user.coins += fallbackAmount;
    await user.save();
    return {
      type: "coins",
      amount: fallbackAmount,
      fallback: true,
      newCoinBalance: user.coins,
    };
  }
  const chosenCategory = isZeroCoinSilver ? "coins" : chosenCategoryItem.type;
  let finalReward = {};

  switch (chosenCategory) {
    case "coins":
      if (isZeroCoinSilver) {
        const amount = 5000;
        user.coins += amount;
        finalReward = { type: "coins", amount }; // Guaranteed free reward
      } else {
        const coinConfig = box.rewards.coins;
        const minReward = Math.floor(price * coinConfig.minScale);
        const maxReward = Math.floor(price * coinConfig.maxScale);
        const amount =
          Math.floor(Math.random() * (maxReward - minReward + 1)) + minReward;

        user.coins += amount;
        finalReward = { type: "coins", amount };
      }
      break;

    case "multiplier":
      const multiplierConfig = box.rewards.multiplier;
      const chosenMultiplierItem = selectWeightedRandom(multiplierConfig.types);
      if (!chosenMultiplierItem) {
        // Add safety check
        console.error(`Error selecting multiplier type for ${boxType} box.`);
        const fallbackAmount = Math.floor(price / 2);
        user.coins += fallbackAmount;
        finalReward = { type: "coins", amount: fallbackAmount, fallback: true };
        break;
      }
      const chosenMultiplier = chosenMultiplierItem.type;
      const currentMultiplierCount =
        user.multipliers.get(chosenMultiplier) || 0;
      user.multipliers.set(chosenMultiplier, currentMultiplierCount + 1);
      finalReward = { type: "multiplier", multiplierType: chosenMultiplier };
      break;

    case "collectible":
      const collectibleConfig = box.rewards.collectible;
      const chosenTierItem = selectWeightedRandom(collectibleConfig.tiers);
      if (!chosenTierItem) {
        // Add safety check
        console.error(`Error selecting collectible tier for ${boxType} box.`);
        // Fallback: Give coins
        const fallbackAmount = Math.floor(price / 3);
        user.coins += fallbackAmount;
        finalReward = { type: "coins", amount: fallbackAmount, fallback: true };
        break;
      }
      const chosenTier = chosenTierItem.tier;
      // Ensure rewards map exists and convert nested objects if needed
      const userRewardsObject = user.rewards.toObject
        ? user.rewards.toObject()
        : user.rewards || {};
      const ownedRewardIds = new Set(
        Object.values(userRewardsObject)
          .flat() // Flatten arrays from all categories
          .map((id) => id?.toString()) // Safely convert to string
          .filter((id) => id != null),
      );
       // query is created and a pool generated based on the user's interests. If no rewards are found, it falls back to a broader query without interest filtering. 
      const userInterests = user.interestAreas || [];
      let query = { tier: chosenTier };

      if (userInterests.length > 0) {
        query.interests = { $in: userInterests };
      }

      let availableRewards = await RewardModel.find(query);
      let unownedRewards = availableRewards.filter(
        (r) => !ownedRewardIds.has(r._id.toString()),
      );

      if (unownedRewards.length === 0 && userInterests.length > 0) {
        availableRewards = await RewardModel.find({ tier: chosenTier });
        unownedRewards = availableRewards.filter(
          (r) => !ownedRewardIds.has(r._id.toString()),
        );
      }

      if (unownedRewards.length > 0) {
        const rewardItem =
          unownedRewards[Math.floor(Math.random() * unownedRewards.length)];
        const rewardCategory = rewardItem.type;
        if (!user.rewards.has(rewardCategory)) {
          user.rewards.set(rewardCategory, []);
        }
        const categoryArray = user.rewards.get(rewardCategory);
        categoryArray.push(rewardItem._id);
        // No need to set again if modifying array in place unless it was newly created
        if (!user.rewards.has(rewardCategory)) {
          // Should not happen now, but safe check
          user.rewards.set(rewardCategory, categoryArray);
        }

        finalReward = { type: "collectible", item: rewardItem };
      } else {
        // Fallback if no unowned rewards found in the chosen tier
        const fallbackAmount = Math.floor(price / 2);
        user.coins += fallbackAmount;
        finalReward = { type: "coins", amount: fallbackAmount, fallback: true };
      }
      break;

    default: // Fallback for unknown category
      console.error(`Unknown reward category selected: ${chosenCategory}`);
      const defaultFallbackAmount = Math.floor(price / 4);
      user.coins += defaultFallbackAmount;
      finalReward = {
        type: "coins",
        amount: defaultFallbackAmount,
        fallback: true,
      };
      break;
  }

  await user.save();

  return {
    ...finalReward,
    newCoinBalance: user.coins,
  };
};
