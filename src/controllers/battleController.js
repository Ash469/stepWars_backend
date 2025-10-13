import { admin } from "../config/firebase.js";
import BattleModel from "../models/battle.js";
import BotService from "../utils/botService.js";
import UserModel from "../models/user.js";
import RewardModel from "../models/reward.js";
import { sendNotificationToUser } from '../utils/notificationService.js';
import { decidePotentialReward } from "../utils/rewardService.js";

const MULTIPLIER_COSTS = {
    '1_5x': 100,
    '2x': 200,
    '3x': 300
};


export const createPvpBattle = async (req, res) => {
    const { player1Id, player2Id } = req.body;
    if (!player1Id || !player2Id) {
        return res.status(400).json({ error: "Both player IDs are required." });
    }

    try {
        const rtdb = admin.database();
        const newGameRef = rtdb.ref("games").push();
        const gameId = newGameRef.key;
        const potentialReward = await decidePotentialReward(player1Id); 
        const newBattle = new BattleModel({
            _id: gameId,
            player1Id: player1Id,
            player2Id: player2Id,
            gameType: 'PVP', 
            status: 'ONGOING',
            potentialReward: potentialReward ? potentialReward._id : null,
        });
        await newBattle.save();

        const rtdbGameData = {
            gameId: gameId,
            player1Id: player1Id,
            player2Id: player2Id,
            gameStatus: 'ongoing',
            startTime: admin.database.ServerValue.TIMESTAMP,
            potentialReward: potentialReward 
                ? { 
                    name: potentialReward.name, 
                    tier: potentialReward.tier, 
                    imagePath: potentialReward.imagePath, 
                    description: potentialReward.description 
                  } 
                : null,
            step1Count: 0,
            step2Count: 0,
            p1Score: 0,
            p2Score: 0,
            multiplier1: 1.0,
            multiplier2: 1.0,
        };
        await newGameRef.set(rtdbGameData);
        res.status(201).json({ gameId: gameId });
    } catch (error) {
        console.error("Error creating PvP battle:", error);
        res.status(500).json({ error: "Could not create PvP battle." });
    }
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
        const savedBattle = await newBattle.save();
        // console.log('[createBotBattle] Document saved to MongoDB:', savedBattle);
        const rtdbGameData = {
            gameId: gameId,
            player1Id: userId,
            player2Id: selectedBot.id,
            gameStatus: 'ongoing',
            startTime: admin.database.ServerValue.TIMESTAMP,
            potentialReward: potentialReward 
                ? { 
                    name: potentialReward.name, 
                    tier: potentialReward.tier, 
                    imagePath: potentialReward.imagePath, 
                    description: potentialReward.description 
                  } 
                : null,
            p1Score: 0,
            p2Score: 0,
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
    const { gameId, userId } = req.body;
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
            p1Score: 0,
            p2Score: 0,
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
    const { gameId, player1FinalScore, player2FinalScore } = req.body;
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
        const { player1Id, player2Id } = battleData;
        const gameType = battleDetails.gameType;
        const p1Score = player1FinalScore ?? battleData.player1Score ?? 0;
        const p2Score = player2FinalScore ?? battleData.player2Score ?? 0;

        if (!player1Id || !player2Id) {
            return res.status(500).json({ error: "Corrupted battle data." });
        }

        let winnerId = null, loserId = null, result = "DRAW", isKnockout = false;
        let winnerCoins = 0, loserCoins = 0;
        const scoreDifference = Math.abs(p1Score - p2Score);
        if (scoreDifference >= 200) {
            result = "KO";
            isKnockout = true;
            winnerId = (p1Score > p2Score) ? player1Id : player2Id;
            loserId = (p1Score > p2Score) ? player2Id : player1Id;
        } else if (scoreDifference > 50) {
            result = "WIN";
            winnerId = (p1Score > p2Score) ? player1Id : player2Id;
            loserId = (p1Score > p2Score) ? player2Id : player1Id;
        } else {
            result = "DRAW";
        }

        // --- (Coin calculation logic remains the same) ---
        if (gameType === 'FRIEND') {
            const pot = p1Score + p2Score;
            if (result === "DRAW") {
                winnerCoins = Math.floor(pot / 2);
                loserCoins = Math.ceil(pot / 2);
            } else {
                winnerCoins = pot;
                loserCoins = 0;
            }
        } else { 
            if (result === "KO") {
                const winnerScore = winnerId === player1Id ? p1Score : p2Score;
                const loserScore = loserId === player1Id ? p1Score : p2Score;
                winnerCoins = winnerScore + 5000;
                loserCoins = loserScore;
            } else if (result === "WIN") {
                const winnerScore = winnerId === player1Id ? p1Score : p2Score;
                const loserScore = loserId === player1Id ? p1Score : p2Score;
                winnerCoins = winnerScore + 2000;
                loserCoins = loserScore;
            } else {
                winnerCoins = p1Score + 1000;
                loserCoins = p2Score + 1000;
            }
        }

        console.log(`[endBattle] Game ${gameId} | Result: ${result} | Winner: ${winnerId} | KO: ${isKnockout} | Scores: P1=${p1Score}, P2=${p2Score}`);
        const updatePromises = [];
        let finalRewardItem = null;

        if (result !== 'DRAW' && winnerId && !winnerId.startsWith('bot_')) {
            const winnerUpdatePayload = {
                $inc: {
                    coins: winnerCoins,
                    'stats.totalBattles': 1,
                    'stats.battlesWon': 1,
                    'stats.knockouts': isKnockout ? 1 : 0,
                }
            };
            if (battleDetails.potentialReward) {
                finalRewardItem = await RewardModel.findById(battleDetails.potentialReward);
                if (finalRewardItem) {
                    const rewardCategory = finalRewardItem.type;
                    winnerUpdatePayload.$push = { [`rewards.${rewardCategory}`]: finalRewardItem._id };
                }
            }
            updatePromises.push(UserModel.findOneAndUpdate({ uid: winnerId }, winnerUpdatePayload));
        }

        if (result !== 'DRAW' && loserId && !loserId.startsWith('bot_')) {
            updatePromises.push(UserModel.findOneAndUpdate({ uid: loserId }, { 
                $inc: { 
                    coins: loserCoins, 
                    'stats.totalBattles': 1 
                } 
            }));
        }

        if (result === 'DRAW') {
            if (!player1Id.startsWith('bot_')) {
                updatePromises.push(UserModel.findOneAndUpdate({ uid: player1Id }, { $inc: { coins: winnerCoins, 'stats.totalBattles': 1 } }));
            }
            if (!player2Id.startsWith('bot_')) {
                updatePromises.push(UserModel.findOneAndUpdate({ uid: player2Id }, { $inc: { coins: loserCoins, 'stats.totalBattles': 1 } }));
            }
        }

        if (updatePromises.length > 0) {
            await Promise.all(updatePromises);
        }

        await BattleModel.findByIdAndUpdate(gameId, {
            status: "COMPLETED",
            winnerId,
            result,
            player1FinalScore: p1Score,
            player2FinalScore: p2Score,
            "rewards.coins": winnerCoins, 
            "rewards.item": finalRewardItem ? finalRewardItem._id : null,
        });
        if (result === 'DRAW') {
            const title = "It's a Draw!";
            const imageUrl = `${process.env.BACKEND_URL}/draw-icon.png`;
            if (!player1Id.startsWith('bot_')) {
                sendNotificationToUser(player1Id, title, `The battle ended in a draw. You earned ${winnerCoins} coins!`, imageUrl);
            }
            if (!player2Id.startsWith('bot_')) {
                sendNotificationToUser(player2Id, title, `The battle ended in a draw. You earned ${loserCoins} coins!`, imageUrl);
            }
        }
        
        else if (result === 'KO') {
             if (winnerId && !winnerId.startsWith('bot_')) {
                const title = '🔥 K.O. VICTORY! 🔥';
                const body = finalRewardItem 
                    ? `Knockout! You earned ${winnerCoins} coins and won a ${finalRewardItem.tier} ${finalRewardItem.name}!`
                    : `Knockout! You crushed your rival. Claim your ${winnerCoins} bonus coins now.`;
                const imageUrl = `${process.env.BACKEND_URL}/ko-icon.png`;
                sendNotificationToUser(winnerId, title, body, imageUrl);
            }
            
            if (loserId && !loserId.startsWith('bot_')) {
                const title = 'K.O. Defeat';
                const body = `You got knocked out! You earned ${loserCoins} coins. Train harder!`;
                const imageUrl = `${process.env.BACKEND_URL}/lose-icon.png`;
                sendNotificationToUser(loserId, title, body, imageUrl);
            }
        } else if (result === 'WIN') {
            if (winnerId && !winnerId.startsWith('bot_')) {
                const title = '🎉 Victory! 🎉';
                const body = finalRewardItem 
                    ? `You won! Earned ${winnerCoins} coins and a ${finalRewardItem.tier} ${finalRewardItem.name}!`
                    : `Congratulations! You won and earned ${winnerCoins} coins!`;
                const imageUrl = `${process.env.BACKEND_URL}/win-icon.png`;
                sendNotificationToUser(winnerId, title, body, imageUrl);
            }
            
            if (loserId && !loserId.startsWith('bot_')) {
                const title = 'Battle Lost';
                const body = `You lost this battle but earned ${loserCoins} coins. Keep fighting!`;
                const imageUrl = `${process.env.BACKEND_URL}/lose-icon.png`;
                sendNotificationToUser(loserId, title, body, imageUrl);
            }
        }


        await rtdbRef.remove();

        const coinsForResponse = (winnerId && winnerId.startsWith('bot_')) ? loserCoins : winnerCoins;

        res.status(200).json({
            finalState: {
                gameType: gameType,
                winnerId,
                loserId,
                result,
                isKnockout,
                player1Score: p1Score,
                player2Score: p2Score,
                rewards: {
                    coins: coinsForResponse,
                    item: finalRewardItem,
                    message: finalRewardItem ? `You won a new ${finalRewardItem.tier} ${finalRewardItem.name}!` : null
                }
            }
        });

    } catch (error) {
        console.error("Error in endBattle controller:", error);
        res.status(500).json({ error: "An unexpected error occurred." });
    }
};

export const cancelFriendBattle = async (req, res) => {
    const { gameId } = req.body;
    if (!gameId) {
        return res.status(400).json({ error: "Game ID is required." });
    }
    try {
        // Delete from Firebase Realtime Database
        const rtdbRef = admin.database().ref(`games/${gameId}`);
        await rtdbRef.remove();

        // Delete from MongoDB
        await BattleModel.findByIdAndDelete(gameId);

        console.log(`[cancelFriendBattle] Successfully cancelled and deleted game ${gameId}.`);
        res.status(200).json({ message: "Battle cancelled successfully." });

    } catch (error) {
        console.error("Error cancelling friend battle:", error);
        res.status(500).json({ error: "Could not cancel friend battle." });
    }
};

export const useMultiplier = async (req, res) => {
    const { gameId, userId, multiplierType } = req.body;

    if (!gameId || !userId || !multiplierType|| !MULTIPLIER_COSTS[multiplierType]) {
        return res.status(400).json({ error: "gameId, userId, and multiplierType are required." });
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
        //notify opponent if not a bot
        const opponentId = isPlayer1 ? gameData.player2Id : gameData.player1Id;
        if (opponentId && !opponentId.startsWith('bot_')) {
            const title = 'Multiplier Activated!';
            const body = `${user.username} has just activated a ${multiplierType.replace('_', '.')}x multiplier!`;
           let imageUrl = '';
            switch (multiplierType) {
                case '1_5x':
                    imageUrl = `{process.env.BACKEND_URL}/public/multiplier-1.5x.png`;
                    break;
                case '2x':
                    imageUrl = `{process.env.BACKEND_URL}/public/multiplier-2x.png`;
                    break;
                case '3x':
                    imageUrl = `{process.env.BACKEND_URL}/public/multiplier-3x.png`;
                    break;
            }
            sendNotificationToUser(opponentId, title, body, imageUrl);
        }
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