import UserModel from '../models/user.js';
import RewardModel from '../models/reward.js';

// --- Configuration for all Mystery Boxes ---
const BOX_CONFIG = {
    bronze: {
        price: 1000,
        rewards: {
            coins: { chance: 40, min: 1000, max: 4000 },
            multiplier: { chance: 30, types: [{ type: '1_5x', chance: 70 }, { type: '2x', chance: 25 }, { type: '3x', chance: 5 }] },
            collectible: { chance: 30, tiers: [{ tier: 'Rare', chance: 80 }, { tier: 'Epic', chance: 20 }] },
        },
    },
    silver: {
        price: 2000,
        rewards: {
            coins: { chance: 35, min: 2000, max: 8000 },
            multiplier: { chance: 25, types: [{ type: '1_5x', chance: 50 }, { type: '2x', chance: 35 }, { type: '3x', chance: 15 }] },
            collectible: { chance: 40, tiers: [{ tier: 'Rare', chance: 50 }, { tier: 'Epic', chance: 35 }, { tier: 'Mythic', chance: 15 }] },
        },
    },
    gold: {
        price: 3000,
        rewards: {
            coins: { chance: 30, min: 5000, max: 15000 },
            multiplier: { chance: 20, types: [{ type: '1_5x', chance: 35 }, { type: '2x', chance: 40 }, { type: '3x', chance: 25 }] },
            collectible: { chance: 50, tiers: [{ tier: 'Epic', chance: 40 }, { tier: 'Mythic', chance: 45 }, { tier: 'Legendary', chance: 15 }] },
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
};

export const openMysteryBox = async (userId, boxType) => {
    const box = BOX_CONFIG[boxType];
    if (!box) throw new Error('Invalid box type.');

    const user = await UserModel.findOne({ uid: userId });
    if (!user) throw new Error('User not found.');
    if (user.coins < box.price) throw new Error('Not enough coins.');

    // Initialize maps if they don't exist
    if (!user.mysteryBoxLastOpened) user.mysteryBoxLastOpened = new Map();
    if (!user.multipliers) user.multipliers = new Map();
    if (!user.rewards) user.rewards = new Map();

    const lastOpened = user.mysteryBoxLastOpened.get(boxType);
    if (lastOpened) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (lastOpened >= today) {
            throw new Error(`You can only open the ${boxType} box once a day.`);
        }
    }

    user.coins -= box.price;
    // --- FIX 1: Use .set() for proper change tracking ---
    user.mysteryBoxLastOpened.set(boxType, new Date());

    const rewardCategories = Object.keys(box.rewards).map(key => ({ type: key, chance: box.rewards[key].chance }));
    const chosenCategory = selectWeightedRandom(rewardCategories).type;
    let finalReward = {};

    switch (chosenCategory) {
        case 'coins':
            const coinConfig = box.rewards.coins;
            const amount = Math.floor(Math.random() * (coinConfig.max - coinConfig.min + 1)) + coinConfig.min;
            user.coins += amount;
            finalReward = { type: 'coins', amount };
            break;

        case 'multiplier':
            const multiplierConfig = box.rewards.multiplier;
            const chosenMultiplier = selectWeightedRandom(multiplierConfig.types).type;
            const currentMultiplierCount = user.multipliers.get(chosenMultiplier) || 0;
            // --- FIX 2: Use .set() for proper change tracking ---
            user.multipliers.set(chosenMultiplier, currentMultiplierCount + 1);
            finalReward = { type: 'multiplier', multiplierType: chosenMultiplier };
            break;

        case 'collectible':
            const collectibleConfig = box.rewards.collectible;
            const chosenTier = selectWeightedRandom(collectibleConfig.tiers).tier;
            const ownedRewardIds = new Set(Object.values(user.rewards.toObject()).flat().map(id => id.toString()));
            const unownedRewards = (await RewardModel.find({ tier: chosenTier })).filter(r => !ownedRewardIds.has(r._id.toString()));

            if (unownedRewards.length > 0) {
                const rewardItem = unownedRewards[Math.floor(Math.random() * unownedRewards.length)];
                const rewardCategory = rewardItem.type;

                // --- FIX 3: Use .set() for proper change tracking ---
                const categoryArray = user.rewards.get(rewardCategory) || [];
                categoryArray.push(rewardItem._id);
                user.rewards.set(rewardCategory, categoryArray);

                finalReward = { type: 'collectible', item: rewardItem };
            } else {
                const fallbackAmount = Math.floor(box.price / 2);
                user.coins += fallbackAmount;
                finalReward = { type: 'coins', amount: fallbackAmount, fallback: true };
            }
            break;
    }

    await user.save();

    return {
        ...finalReward,
        newCoinBalance: user.coins,
    };
};