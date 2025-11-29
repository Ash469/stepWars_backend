import { admin } from "../config/firebase.js";
import BattleModel from "../models/battle.js";
import BotService from "../utils/botService.js";
import UserModel from "../models/user.js";
import RewardModel from "../models/reward.js";
import { sendNotificationToUser } from '../utils/notificationService.js';
import { decidePotentialReward } from "../utils/rewardService.js";
import { getMultiplierCosts } from '../config/remoteConfigService.js';


// --- createPvpBattle, createBotBattle, createFriendBattle, joinFriendBattle remain the same ---
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
            player1Score: 0,
            player2Score: 0,
            multiplier1: 1.0,
            multiplier2: 1.0,
            player1MultiplierUsed: false,
            player2MultiplierUsed: false
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
        if (!selectedBot) {
             throw new Error(`Bot with ID ${botId || 'random'} not found.`);
        }
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
            step1Count: 0,
            step2Count: 0,
            player1Score: 0,
            player2Score: 0,
            multiplier1: 1.0,
            multiplier2: 1.0,
            player1MultiplierUsed: false,
            player2MultiplierUsed: false
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

        const potentialReward = await decidePotentialReward(userId);

        const newBattle = new BattleModel({
            _id: gameId,
            player1Id: userId,
            gameType: 'FRIEND',
            status: 'WAITING',
            potentialReward: potentialReward ? potentialReward._id : null,
        });
        await newBattle.save();
        const rtdbGameData = {
            gameId: gameId,
            player1Id: userId,
            gameStatus: 'waiting',
             potentialReward: potentialReward
                ? {
                    name: potentialReward.name,
                    tier: potentialReward.tier,
                    imagePath: potentialReward.imagePath,
                    description: potentialReward.description
                }
                : null,
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

        const potentialRewardP2 = await decidePotentialReward(userId);

        battle.player2Id = userId;
        battle.status = 'ONGOING';
        await battle.save();

        const rtdbGameRef = admin.database().ref(`games/${gameId}`);
        const rtdbUpdateData = {
            player2Id: userId,
            gameStatus: 'ongoing',
            startTime: admin.database.ServerValue.TIMESTAMP,
            step1Count: 0,
            step2Count: 0,
            player1Score: 0,
            player2Score: 0,
            multiplier1: 1.0,
            multiplier2: 1.0,
            player1MultiplierUsed: false,
            player2MultiplierUsed: false,
             potentialRewardP2: potentialRewardP2
                ? {
                    name: potentialRewardP2.name,
                    tier: potentialRewardP2.tier,
                    imagePath: potentialRewardP2.imagePath,
                    description: potentialRewardP2.description
                 }
                 : null
        };
        await rtdbGameRef.update(rtdbUpdateData);
        res.status(200).json({ message: "Successfully joined battle.", gameId: gameId });
    } catch (error) {
        console.error("Error joining friend battle:", error);
        res.status(500).json({ error: "Could not join friend battle." });
    }
};

const sendNotificationsAndCleanup = async (gameId, result, player1Id, player2Id, winnerId, loserId, finalRewardItem, winnerCoins, loserCoins) => {
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:8080';
    let title = '';
    let winnerBody = '', loserBody = '', drawP1Body = '', drawP2Body = '';
    let imageUrl = '', winImageUrl = '', lossImageUrl = '';
    
    try {
        if (result === 'DRAW') {
            title = "It's a Draw!";
            drawP1Body = `The battle ended in a draw. You earned ${winnerCoins} coins!`;
            drawP2Body = `The battle ended in a draw. You earned ${loserCoins} coins!`;
            imageUrl = `${baseUrl}/public/draw-icon.png`;

             console.log(`[endBattle Cleanup] Preparing DRAW notifications.`);
             if (!player1Id.startsWith('bot_')) {
                  sendNotificationToUser(player1Id, title, drawP1Body, imageUrl);
             }
             if (!player2Id.startsWith('bot_')) {
                  sendNotificationToUser(player2Id, title, drawP2Body, imageUrl);
             }

        } else if (result === 'KO') {
            const koTitleWin = '👑 K.O. VICTORY! 👑';
            const koTitleLoss = 'K.O. Defeat';
            winnerBody = finalRewardItem
                    ? `Knockout! You earned ${winnerCoins} coins and won a ${finalRewardItem.tier} ${finalRewardItem.name}!`
                    : `Knockout! You crushed your rival. Claim your ${winnerCoins} bonus coins now.`;
            loserBody = `You got knocked out! You earned ${loserCoins} coins. Train harder!`;
            winImageUrl = `${baseUrl}/public/ko-icon.png`;
            lossImageUrl = `${baseUrl}/public/lose-icon.png`;

             console.log(`[endBattle Cleanup] Preparing KO notifications.`);
            if (winnerId && !winnerId.startsWith('bot_')) {
                  sendNotificationToUser(winnerId, koTitleWin, winnerBody, winImageUrl);
            }
            if (loserId && !loserId.startsWith('bot_')) {
                  sendNotificationToUser(loserId, koTitleLoss, loserBody, lossImageUrl);
            }

        } else if (result === 'WIN') {
            const winTitleWin = '🏆 Victory! 🏆';
            const winTitleLoss = 'Battle Lost';
             winnerBody = finalRewardItem
                    ? `You won! Earned ${winnerCoins} coins and a ${finalRewardItem.tier} ${finalRewardItem.name}!`
                    : `Congratulations! You won and earned ${winnerCoins} coins!`;
            loserBody = `You lost this battle but earned ${loserCoins} coins. Keep fighting!`;
            winImageUrl = `${baseUrl}/public/win-icon.png`;
            lossImageUrl = `${baseUrl}/public/lose-icon.png`;

            if (winnerId && !winnerId.startsWith('bot_')) {
                  sendNotificationToUser(winnerId, winTitleWin, winnerBody, winImageUrl);
            }
            if (loserId && !loserId.startsWith('bot_')) {
                  sendNotificationToUser(loserId, winTitleLoss, loserBody, lossImageUrl);
            }
        }
    
        const rtdbRef = admin.database().ref(`games/${gameId}`);
    
    // Update RTDB to let the other player know the game is over
    await rtdbRef.update({
        gameStatus: 'completed',
        result: result,
        winnerId: winnerId,
        loserId: loserId,
        'rewards/winnerCoins': winnerCoins,
        'rewards/loserCoins': loserCoins,
        'rewards/item': finalRewardItem ? {
            name: finalRewardItem.name,
            tier: finalRewardItem.tier,
            imagePath: finalRewardItem.imagePath
        } : null
    });

    // Clean up after 60 seconds to allow clients to sync
    setTimeout(() => {
        rtdbRef.remove().catch(err => console.error("Error removing game node:", err));
    }, 60000);
        
    } catch(error) {
         console.error(`[endBattle Background Task] CRITICAL ERROR during cleanup for ${gameId}:`, error);
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
        const player1Id = battleData?.player1Id;
        const player2Id = battleData?.player2Id;
        if (!player1Id || !player2Id) {
             return res.status(500).json({ error: "Corrupted battle data." });
        }

        const gameType = battleDetails.gameType;
        const p1Score = player1FinalScore ?? battleData.player1Score ?? 0;
        const p2Score = player2FinalScore ?? battleData.player2Score ?? 0;

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
        if (gameType === 'FRIEND') {
            const pot = p1Score + p2Score;
            if (result === "DRAW") {
                winnerCoins = Math.floor(pot / 2);
                loserCoins = Math.ceil(pot / 2);
            } else {
                winnerCoins = pot;
                loserCoins = 0;
            }
        } else { // BOT or PVP
            if (result === "KO") {
                const winnerScore = winnerId === player1Id ? p1Score : p2Score;
                const loserScore = loserId === player1Id ? p1Score : p2Score;
                winnerCoins = winnerScore + 3000;
                loserCoins = loserScore;
            } else if (result === "WIN") {
                const winnerScore = winnerId === player1Id ? p1Score : p2Score;
                const loserScore = loserId === player1Id ? p1Score : p2Score;
                winnerCoins = winnerScore + 1000;
                loserCoins = loserScore;
            } else { // DRAW
                winnerCoins = p1Score ;
                loserCoins = p2Score ;
            }
        }

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
            if (winnerId === player1Id && battleDetails.potentialReward) {
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
            loserId,
            result,
            player1FinalScore: p1Score,
            player2FinalScore: p2Score,
            "rewards.coins": winnerId ? winnerCoins : 0,
            "rewards.item": finalRewardItem ? finalRewardItem._id : null,
        });

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
                    winnerCoins: winnerCoins,
                    loserCoins: loserCoins,
                    item: finalRewardItem ? {
                       name: finalRewardItem.name,
                       tier: finalRewardItem.tier,
                       imagePath: finalRewardItem.imagePath,
                       description: finalRewardItem.description
                    } : null,
                    message: finalRewardItem ? `You won a new ${finalRewardItem.tier} ${finalRewardItem.name}!` : null
                }
            }
        });

        sendNotificationsAndCleanup(gameId, result, player1Id, player2Id, winnerId, loserId, finalRewardItem, winnerCoins, loserCoins)
            .catch(error => {
                console.error(`[endBattle Background Task] Error in async cleanup for ${gameId}:`, error);
            });


    } catch (error) {
        console.error("[endBattle] Error in endBattle controller:", error);
        if (!res.headersSent) {
             res.status(500).json({ error: "An unexpected error occurred." });
        }
    }
};

export const cancelFriendBattle = async (req, res) => {
    const { gameId } = req.body;
    if (!gameId) {
        return res.status(400).json({ error: "Game ID is required." });
    }
    try {
        const rtdbRef = admin.database().ref(`games/${gameId}`);
        await rtdbRef.remove();
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
    const MULTIPLIER_COSTS = getMultiplierCosts();

    if (!gameId || !userId || !multiplierType || !MULTIPLIER_COSTS[multiplierType]) {
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

        const opponentId = isPlayer1 ? gameData.player2Id : gameData.player1Id;
         const baseUrl = process.env.BACKEND_URL || 'http://localhost:8080';
        if (opponentId && !opponentId.startsWith('bot_')) {
            const title = 'Multiplier Activated!';
            const body = `${user.username || 'Opponent'} has just activated a ${multiplierType.replace('_', '.')}x multiplier!`;
            let imageUrl = '';
            switch (multiplierType) {
                case '1_5x':
                    imageUrl = `${baseUrl}/public/multiplier-1.5x.png`;
                    break;
                case '2x':
                    imageUrl = `${baseUrl}/public/multiplier-2x.png`;
                    break;
                case '3x':
                    imageUrl = `${baseUrl}/public/multiplier-3x.png`;
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

