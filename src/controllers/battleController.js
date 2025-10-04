import { admin } from "../config/firebase.js";
import BattleModel from "../models/battle.js";
import BotService from "../utils/botService.js";
import UserModel from "../models/user.js";
import { generateUniqueReward } from "../utils/rewardService.js";


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
        const snapshot = await rtdbRef.once("value");

        if (!snapshot.exists()) {
            return res.status(404).json({ error: "Battle not found in Realtime Database." });
        }
        
        const battleData = snapshot.val();
        const { player1Id, player2Id, player1Score = 0, player2Score = 0 } = battleData;

        if (!player1Id || !player2Id) {
            return res.status(500).json({ error: "Corrupted battle data: missing player IDs." });
        }
        
        let winnerId = null;
        let loserId = null;
        let result = "DRAW";
        let isKnockout = false;

        const scoreDifference = Math.abs(player1Score - player2Score);

        if (scoreDifference >= 1000) {
            // It's a Knockout win
            isKnockout = true;
            result = "KO";
            if (player1Score > player2Score) {
                winnerId = player1Id;
                loserId = player2Id;
            } else {
                winnerId = player2Id;
                loserId = player1Id;
            }
        } else if (scoreDifference > 100) {
            // It's a standard Win by points
            result = "WIN";
            if (player1Score > player2Score) {
                winnerId = player1Id;
                loserId = player2Id;
            } else {
                winnerId = player2Id;
                loserId = player1Id;
            }
        } else {
            // It's a Draw
            result = "DRAW";
        }

        console.log(`[endBattle] Game ${gameId} Result: ${result}, Winner: ${winnerId}, KO: ${isKnockout}`);

        // --- Generate Reward for the Winner ---
        let rewardResult = {};
        if (winnerId) {
            rewardResult = await generateUniqueReward(winnerId);
        }

        // --- Prepare Database Updates for Both Players ---
        const updatePromises = [];
        const winnerCoins = (result === "DRAW") ? 25 : 150;
        const loserCoins = (result === "DRAW") ? 25 : 10;

        // Prepare winner's update operation
        if (winnerId) {
            const winnerUpdate = {
                $inc: {
                    coins: winnerCoins,
                    'stats.totalBattles': 1,
                    'stats.battlesWon': 1,
                    'stats.knockouts': isKnockout ? 1 : 0,
                }
            };
            updatePromises.push(UserModel.findOneAndUpdate({ uid: winnerId }, winnerUpdate));
        }

        // Prepare loser's update operation
        if (loserId) {
            const loserUpdate = {
                $inc: {
                    coins: loserCoins,
                    'stats.totalBattles': 1,
                }
            };
            updatePromises.push(UserModel.findOneAndUpdate({ uid: loserId }, loserUpdate));
        }
        
        // Handle stat updates for a DRAW
        if (result === "DRAW") {
             const player1DrawUpdate = UserModel.findOneAndUpdate({ uid: player1Id }, { $inc: { coins: winnerCoins, 'stats.totalBattles': 1 } });
             const player2DrawUpdate = UserModel.findOneAndUpdate({ uid: player2Id }, { $inc: { coins: loserCoins, 'stats.totalBattles': 1 } });
             updatePromises.push(player1DrawUpdate, player2DrawUpdate);
        }

        // Execute all user updates concurrently
        await Promise.all(updatePromises);
        
        // --- Save Final Battle State to MongoDB ---
        const finalBattleState = {
            status: "COMPLETED",
            winnerId: winnerId,
            result: result,
            player1FinalScore: player1Score,
            player2FinalScore: player2Score,
            rewards: {
                coins: winnerCoins + (rewardResult.granted === 'coins' ? rewardResult.amount : 0),
                item: rewardResult.granted === 'item' ? rewardResult.item._id : null
            },
        };

        await BattleModel.findByIdAndUpdate(gameId, finalBattleState, { new: true, upsert: true });

        // // --- Clean up Realtime Database ---
        // await rtdbRef.remove();

        // --- Send Final Response to Flutter ---
        res.status(200).json({
            message: "Battle ended successfully.",
            finalState: {
                winnerId: winnerId,
                result: result,
                rewards: {
                    coins: finalBattleState.rewards.coins,
                    item: rewardResult.granted === 'item' ? rewardResult.item : null,
                    message: rewardResult.reason || (rewardResult.item ? `You won a new ${rewardResult.item.tier} item!` : null)
                }
            }
        });

    } catch (error) {
        console.error("Error in endBattle controller:", error);
        res.status(500).json({ error: "An unexpected error occurred while ending the battle." });
    }
};