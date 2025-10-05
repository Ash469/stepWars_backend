import { admin } from "../config/firebase.js";
import BattleModel from "../models/battle.js";
import BotService from "../utils/botService.js";
import UserModel from "../models/user.js";
import { generateUniqueReward } from "../utils/rewardService.js";

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

        if (!gameId) {
            throw new Error("Failed to generate a unique game ID from Firebase.");
        }
        let selectedBot;
        if (botId) {
            selectedBot = BotService.getBotById(botId);
            if (!selectedBot) {
                console.warn(`[BotBattle] Invalid botId '${botId}' received. Selecting random bot as a fallback.`);
                selectedBot = BotService.selectRandomBot();
            }
        } else {
            selectedBot = BotService.selectRandomBot();
        }

        const newBattle = new BattleModel({
            _id: gameId,
            player1Id: userId,
            player2Id: selectedBot.id,
            gameType: 'BOT',
            status: 'ONGOING',
        });
        await newBattle.save();

        const rtdbGameData = {
            gameId: gameId,
            player1Id: userId,
            player2Id: selectedBot.id,
            gameStatus: 'ongoing',
            startTime: admin.database.ServerValue.TIMESTAMP,
            step1Count: 0,
            step2Count: 0,
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
    if (!gameId) {
        return res.status(400).json({ error: "Game ID is required" });
    }

    try {
        const rtdb = admin.database();
        const rtdbRef = rtdb.ref(`games/${gameId}`);
        const [snapshot, battleDetails] = await Promise.all([
            rtdbRef.once("value"),
            BattleModel.findById(gameId)
        ]);

        if (!snapshot.exists() || !battleDetails) {
            return res.status(404).json({ error: "Battle not found." });
        }

        const battleData = snapshot.val();
        const { player1Id, player2Id, player1Score = 0, player2Score = 0 } = battleData;
        const gameType = battleDetails.gameType; // 'BOT' or 'FRIEND'

        if (!player1Id || !player2Id) {
            return res.status(500).json({ error: "Corrupted battle data: missing player IDs." });
        }
        let winnerId = null;
        let loserId = null;
        let result = "DRAW";
        let isKnockout = false;
        let winnerCoins = 0;
        let loserCoins = 0;

        if (gameType === 'FRIEND') {
            console.log(`[endBattle] Applying FRIEND logic for game ${gameId}`);
            const pot = player1Score + player2Score;
            const scoreDifference = Math.abs(player1Score - player2Score);

            if (scoreDifference >= 5000) {
                result = "KO";
                isKnockout = true;
                winnerCoins = pot; // Winner takes all
            } else if (scoreDifference > 100) {
                result = "WIN";
                winnerCoins = pot; // Winner takes all
            } else {
                result = "DRAW";
                winnerCoins = Math.floor(pot / 2); // Split the pot
                loserCoins = Math.ceil(pot / 2);
            }

            if (result !== "DRAW") {
                winnerId = (player1Score > player2Score) ? player1Id : player2Id;
                loserId = (player1Score > player2Score) ? player2Id : player1Id;
            }

        } else {
            console.log(`[endBattle] Applying BOT logic for game ${gameId}`);
            const scoreDifference = Math.abs(player1Score - player2Score);

            if (scoreDifference >= 100) {
                result = "KO";
                isKnockout = true;
            } else if (scoreDifference > 20) {
                result = "WIN";
            } else {
                result = "DRAW";
            }

            if (result === "DRAW") {
                winnerCoins = 25;
                loserCoins = 25;
            } else {
                winnerId = (player1Score > player2Score) ? player1Id : player2Id;
                loserId = (player1Score > player2Score) ? player2Id : player1Id;
                winnerCoins = 150;
                loserCoins = 10;
            }
        }

        console.log(`[endBattle] Result: ${result}, Winner: ${winnerId}`);

        let rewardResult = {};
        if (winnerId) {
            rewardResult = await generateUniqueReward(winnerId);
        }

        const updatePromises = [];
        if (result === "DRAW") {
            const p1Update = UserModel.findOneAndUpdate({ uid: player1Id }, { $inc: { coins: winnerCoins, 'stats.totalBattles': 1 } });
            const p2Update = UserModel.findOneAndUpdate({ uid: player2Id }, { $inc: { coins: loserCoins, 'stats.totalBattles': 1 } });
            updatePromises.push(p1Update, p2Update);
            // updateDailyActivity(player1Id, { $inc: { totalBattles: 1, coinsEarned: winnerCoins } });
            // updateDailyActivity(player2Id, { $inc: { totalBattles: 1, coinsEarned: loserCoins } });
        } else {
            const winnerUpdate = UserModel.findOneAndUpdate({ uid: winnerId }, {
                $inc: {
                    coins: winnerCoins,
                    'stats.totalBattles': 1,
                    'stats.battlesWon': 1,
                    'stats.knockouts': isKnockout ? 1 : 0,
                }
            });
            const loserUpdate = UserModel.findOneAndUpdate({ uid: loserId }, {
                $inc: {
                    coins: loserCoins,
                    'stats.totalBattles': 1
                }
            });
            updatePromises.push(winnerUpdate, loserUpdate);
            // // ✨ Log daily activity for winner and loser
            // updateDailyActivity(winnerId, {
            //     $inc: {
            //         totalBattles: 1,
            //         battlesWon: 1,
            //         knockouts: isKnockout ? 1 : 0,
            //         coinsEarned: winnerCoins
            //     }
            // });
            // updateDailyActivity(loserId, {
            //     $inc: {
            //         totalBattles: 1,
            //         coinsEarned: loserCoins
            //     }
            // });
        }
        await Promise.all(updatePromises);

        const finalBattleState = {
            status: "COMPLETED",
            winnerId,
            result,
            player1FinalScore: player1Score,
            player2FinalScore: player2Score,
            rewards: {
                coins: winnerCoins + (rewardResult.granted === 'coins' ? rewardResult.amount : 0),
                item: rewardResult.granted === 'item' ? rewardResult.item._id : null
            },
        };
        await BattleModel.findByIdAndUpdate(gameId, finalBattleState, { new: true, upsert: true });

        await rtdbRef.remove();

        res.status(200).json({
            message: "Battle ended successfully.",
            finalState: {
                winnerId,
                result,
                rewards: {
                    coins: finalBattleState.rewards.coins,
                    item: rewardResult.granted === 'item' ? rewardResult.item : null,
                    message: rewardResult.reason || (rewardResult.item ? `You won a new ${rewardResult.item.tier} item!` : null)
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

        const multiplierValue = parseFloat(multiplierType.replace('x', ''));

        if (gameData.player1Id === userId) {
            await gameRef.update({ multiplier1: multiplierValue });
        } else if (gameData.player2Id === userId) {
            await gameRef.update({ multiplier2: multiplierValue });
        } else {
            return res.status(403).json({ error: "User is not a player in this game." });
        }

        res.status(200).json({ success: true, message: `Multiplier ${multiplierType} activated!` });

    } catch (error) {
        console.error("Error in useMultiplier controller:", error);
        res.status(500).json({ error: "An unexpected server error occurred." });
    }
};