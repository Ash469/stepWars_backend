import { admin } from "../config/firebase.js";
import BattleModel from "../models/battle.js";
import BotService from "../utils/botService.js";
import UserModel from "../models/user.js";
import RewardModel from "../models/reward.js";
import { decidePotentialReward } from "../utils/rewardService.js";

const MULTIPLIER_COSTS = {
    '1_5x': 15,
    '2x': 20,
    '3x': 30
};

export const createBotBattle = async (req, res) => {
    const { userId, botId } = req.body;
    if (!userId) {
        return res.status(400).json({ error: "User ID is required." });
    }

    try {
        const rtdb = admin.database();
        const newGameRef = rtdb.ref("games").push();
        const gameId = newGameRef.key;

        const selectedBot = botId ? BotService.getBotById(botId) : BotService.selectRandomBot();

        const potentialReward = await decidePotentialReward(userId);
        console.log(`[createBotBattle] Potential reward selected for game ${gameId}: ${potentialReward?.name || 'None'}`);

        const newBattle = new BattleModel({
            _id: gameId,
            player1Id: userId,
            player2Id: selectedBot.id,
            gameType: 'BOT',
            status: 'ONGOING',
            potentialReward: potentialReward ? potentialReward._id : null,
        });
        await newBattle.save();

        const rtdbGameData = {
            gameId: gameId,
            player1Id: userId,
            player2Id: selectedBot.id,
            gameStatus: 'ongoing',
            startTime: admin.database.ServerValue.TIMESTAMP,
            potentialReward: potentialReward ? { name: potentialReward.name, tier: potentialReward.tier } : null,
            player1Score: 0,
            player2Score: 0,
            multiplier1: 1.0,
            multiplier2: 1.0,
        };
        await newGameRef.set(rtdbGameData);

        res.status(201).json({ gameId: gameId });

    } catch (error) {
        console.error("Error creating bot battle:", error);
        res.status(500).json({ error: "Could not create bot battle." });
    }
};

export const createFriendBattle = async (req, res) => {
    const { userId } = req.body;
    if (!userId) {
        return res.status(400).json({ error: "User ID is required." });
    }

    try {
        const rtdb = admin.database();
        let gameId;
        let gameRef;
        do {
            gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
            gameRef = rtdb.ref(`games/${gameId}`);
        } while ((await gameRef.once('value')).exists());
        const newBattle = new BattleModel({
            _id: gameId,
            player1Id: userId,
            gameType: 'FRIEND',
            status: 'WAITING',
        });
        await newBattle.save();
        const rtdbGameData = {
            gameId: gameId,
            player1Id: userId,
            gameStatus: 'waiting',
        };
        await gameRef.set(rtdbGameData);

        res.status(201).json({ gameId: gameId });

    } catch (error) {
        console.error("Error creating friend battle:", error);
        res.status(500).json({ error: "Could not create friend battle." });
    }
};

export const joinFriendBattle = async (req, res) => {
    const { gameId, userId } = req.body; // userId is player 2
    if (!gameId || !userId) {
        return res.status(400).json({ error: "Game ID and User ID are required." });
    }

    try {
        const battle = await BattleModel.findById(gameId);

        if (!battle) {
            return res.status(404).json({ error: "Battle not found." });
        }
        if (battle.status !== 'WAITING') {
            return res.status(403).json({ error: "This battle is not available to join." });
        }
        if (battle.player1Id === userId) {
            return res.status(400).json({ error: "You cannot join your own game." });
        }
        battle.player2Id = userId;
        battle.status = 'ONGOING';
        await battle.save();
        const rtdbGameRef = admin.database().ref(`games/${gameId}`);
        const rtdbUpdateData = {
            player2Id: userId,
            gameStatus: 'ongoing',
            startTime: Date.now(),
            step1Count: 0,
            step2Count: 0,
            player1Score: 0,
            player2Score: 0,
            multiplier1: 1.0,
            multiplier2: 1.0,
        };
        await rtdbGameRef.update(rtdbUpdateData);

        res.status(200).json({ message: "Successfully joined battle.", gameId: gameId });

    } catch (error) {
        console.error("Error joining friend battle:", error);
        res.status(500).json({ error: "Could not join friend battle." });
    }
};

export const endBattle = async (req, res) => {
    const { gameId } = req.body;
    if (!gameId) return res.status(400).json({ error: "Game ID is required" });

    try {
        const rtdbRef = admin.database().ref(`games/${gameId}`);
        const [snapshot, battleDetails] = await Promise.all([
            rtdbRef.once("value"),
            BattleModel.findById(gameId)
        ]);

        if (!snapshot.exists() || !battleDetails) {
            return res.status(404).json({ error: "Battle not found." });
        }

        const battleData = snapshot.val();
        console.log(`battelData: ${battleData}`);
        const { player1Id, player2Id, player1Score = 0, player2Score = 0 } = battleData;

        const gameType = battleDetails.gameType;

        if (!player1Id || !player2Id) {
            return res.status(500).json({ error: "Corrupted battle data." });
        }

        let winnerId = null, loserId = null, result = "DRAW", isKnockout = false;
        let winnerCoins = 0, loserCoins = 0;
        const scoreDifference = Math.abs(player1Score - player2Score);

        if (gameType === 'FRIEND') {
            if (scoreDifference >= 5000) { result = "KO"; isKnockout = true; }
            else if (scoreDifference > 100) { result = "WIN"; }
            const pot = player1Score + player2Score;
            result === "DRAW" ? (winnerCoins = Math.floor(pot / 2), loserCoins = Math.ceil(pot / 2)) : (winnerCoins = pot);
        } else { // BOT Battle Logic
            if (scoreDifference >= 1000) { result = "KO"; isKnockout = true; }
            else if (scoreDifference > 100) { result = "WIN"; }
            result === "DRAW" ? (winnerCoins = 25, loserCoins = 25) : (winnerCoins = 150, loserCoins = 10);
        }

        if (result !== "DRAW") {
            winnerId = (player1Score > player2Score) ? player1Id : player2Id;
            loserId = (player1Score > player2Score) ? player2Id : player1Id;
        }

        console.log(`[endBattle] Game ${gameId} Result: ${result}, Winner: ${winnerId}, KO: ${isKnockout}`);

        let finalRewardItem = null;
        if (winnerId && !winnerId.startsWith('bot_') && battleDetails.potentialReward) {
            const rewardToGrant = await RewardModel.findById(battleDetails.potentialReward);
            if (rewardToGrant) {
                const rewardCategory = rewardToGrant.type;
                await UserModel.updateOne({ uid: winnerId }, { $push: { [`rewards.${rewardCategory}`]: rewardToGrant._id } });
                finalRewardItem = rewardToGrant;
                console.log(`[endBattle] Granted pre-selected reward '${rewardToGrant.name}' to ${winnerId}.`);
            }
        }

        const updatePromises = [];
        if (result === 'DRAW') {
            console.log("Result is DRAW. Preparing to update real user stats.");

            // Only prepare an update if player 1 is NOT a bot
            if (!player1Id.startsWith('bot_')) {
                const p1Update = UserModel.findOneAndUpdate(
                    { uid: player1Id },
                    { $inc: { coins: winnerCoins, 'stats.totalBattles': 1 } },
                    { new: true } // Use this to debug!
                );
                updatePromises.push(p1Update);
            }

            // Only prepare an update if player 2 is NOT a bot
            if (!player2Id.startsWith('bot_')) {
                const p2Update = UserModel.findOneAndUpdate(
                    { uid: player2Id },
                    { $inc: { coins: loserCoins, 'stats.totalBattles': 1 } },
                    { new: true }
                );
                updatePromises.push(p2Update);
            }

        } else {
            console.log("stats update if result is not a draw");
            if (winnerId && !winnerId.startsWith('bot_')) {
                const winnerUpdate = UserModel.findOneAndUpdate({ uid: winnerId }, {
                    $inc: {
                        coins: winnerCoins,
                        'stats.totalBattles': 1,
                        'stats.battlesWon': 1,
                        'stats.knockouts': isKnockout ? 1 : 0,
                    }
                });
                updatePromises.push(winnerUpdate);
            }

            if (loserId && !loserId.startsWith('bot_')) {
                const loserUpdate = UserModel.findOneAndUpdate({ uid: loserId }, {
                    $inc: {
                        coins: loserCoins,
                        'stats.totalBattles': 1
                    }
                }, { new: true });
                updatePromises.push(loserUpdate);
            }
        }
        if (updatePromises.length > 0) {
            const updateResults = await Promise.all(updatePromises);
            // console.log("Database update results:", updateResults);
        }

        const finalBattleState = {
            status: "COMPLETED",
            winnerId,
            result,
            player1FinalScore: player1Score,
            player2FinalScore: player2Score,
        };


        await BattleModel.findByIdAndUpdate(gameId, {
            status: "COMPLETED", winnerId, result, player1FinalScore: player1Score, player2FinalScore: player2Score,
            "rewards.coins": winnerCoins,
            "rewards.item": finalRewardItem ? finalRewardItem._id : null,
        });

        await rtdbRef.remove();

        res.status(200).json({
            finalState: {
                winnerId,
                result,
                rewards: {
                    coins: winnerCoins,
                    item: finalRewardItem,
                    message: finalRewardItem ? `You won a new ${finalRewardItem.tier} item!` : null
                }
            }
        });

    } catch (error) {
        console.error("Error in endBattle controller:", error);
        res.status(500).json({ error: "An unexpected error occurred." });
    }
};

export const useMultiplier = async (req, res) => {
    const { gameId, userId, multiplierType } = req.body;

    if (!gameId || !userId || !multiplierType) {
        return res.status(400).json({ error: "gameId, userId, and multiplierType are required." });
    }

    if (!MULTIPLIER_COSTS[multiplierType]) {
        return res.status(400).json({ error: "Invalid multiplier type." });
    }

    try {
        const user = await UserModel.findOne({ uid: userId });
        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

        const hasMultiplier = (user.multipliers.get(multiplierType) || 0) > 0;
        let updateOperation = {};

        if (hasMultiplier) {
            console.log(`User ${userId} is using an existing '${multiplierType}' multiplier.`);
            updateOperation = { $inc: { [`multipliers.${multiplierType}`]: -1 } };

        } else {
            const cost = MULTIPLIER_COSTS[multiplierType];
            console.log(`User ${userId} is buying a '${multiplierType}' multiplier for ${cost} coins.`);

            if (user.coins < cost) {
                return res.status(402).json({ error: "Not enough coins." });
            }
            updateOperation = { $inc: { coins: -cost } };
        }

        await UserModel.updateOne({ uid: userId }, updateOperation);

        const rtdb = admin.database();
        const gameRef = rtdb.ref(`games/${gameId}`);
        const gameSnapshot = await gameRef.once('value');
        const gameData = gameSnapshot.val();

        if (!gameData) {
            return res.status(404).json({ error: "Game not found in Realtime Database." });
        }
        const isPlayer1 = gameData.player1Id === userId;
        if ((isPlayer1 && gameData.player1MultiplierUsed) || (!isPlayer1 && gameData.player2MultiplierUsed)) {
            return res.status(403).json({ error: "You have already used a multiplier in this battle." });
        }
        await UserModel.updateOne({ uid: userId }, updateOperation);

        const multiplierValue = parseFloat(multiplierType.replace('_', '.').replace('x', ''));

        if (isPlayer1) {
            await gameRef.update({ multiplier1: multiplierValue, player1MultiplierUsed: true });
        } else {
            await gameRef.update({ multiplier2: multiplierValue, player2MultiplierUsed: true });
        }

        res.status(200).json({ success: true, message: `Multiplier ${multiplierType} activated!` });

    } catch (error) {
        console.error("Error in useMultiplier controller:", error);
        res.status(500).json({ error: "An unexpected server error occurred." });
    }
};