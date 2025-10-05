import UserModel from '../models/user.js'; 
import RewardModel from '../models/reward.js';


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


export async function generateUniqueReward(winnerId) {
    try {
        const winner = await UserModel.findOne({ uid: winnerId });
        if (!winner) throw new Error(`Winner with ID ${winnerId} not found`);
        const ownedRewardIds = new Set(
            Object.values(winner.rewards.toObject()).flat().map(id => id.toString())
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
                const grantedReward = unownedRewards[randomIndex];

                const rewardCategory = grantedReward.type;
                await UserModel.updateOne(
                    { uid: winnerId },
                    { $push: { [`rewards.${rewardCategory}`]: grantedReward._id } }
                );
                console.log(`Granted new reward: '${grantedReward.name}' to user ${winnerId}`);
                return { granted: 'item', item: grantedReward };
            }
        }

        // Fallback to coins if user owns everything
        const fallbackCoins = 500;
        await UserModel.updateOne({ uid: winnerId }, { $inc: { coins: fallbackCoins } });
        return { granted: 'coins', amount: fallbackCoins, reason: 'All items collected!' };

    } catch (error) {
        console.error("Error in generateUniqueReward:", error);
        return { granted: 'error', reason: 'Server error during reward generation.' };
    }
};