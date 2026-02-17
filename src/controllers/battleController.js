import { admin } from "../config/firebase.js";
import BattleModel from "../models/battle.js";
import BotService from "../utils/botService.js";
import UserModel from "../models/user.js";
import RewardModel from "../models/reward.js";
import { sendNotificationToUser } from '../utils/notificationService.js';
import { decidePotentialReward } from "../utils/rewardService.js";
import { getMultiplierCosts, getWinSteps } from '../config/remoteConfigService.js';


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
        // determine selected bot
        const selectedBot = botId ? BotService.getBotById(botId) : BotService.selectRandomBot();
        if (!selectedBot) {
            throw new Error(`Bot with ID ${botId || 'random'} not found.`);
        }
        const entryCost = 500;

        // fetch user and deduct cost
        const user = await UserModel.findOne({ uid: userId });
        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }
        if (user.coins < entryCost) {
            return res.status(402).json({ error: "Not enough coins to play this bot battle." });
        }

        // deduct coins
        await UserModel.updateOne({ uid: userId }, { $inc: { coins: -entryCost } });

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
const sendNotificationsOnlyAndCleanup = async (gameId, result, player1Id, player2Id, winnerId, loserId, finalRewardItem, winnerCoins, loserCoins) => {
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

            if (!player1Id.startsWith('bot_')) sendNotificationToUser(player1Id, title, drawP1Body, imageUrl);
            if (!player2Id.startsWith('bot_')) sendNotificationToUser(player2Id, title, drawP2Body, imageUrl);

        } else if (result === 'KO') {
            const koTitleWin = 'K.O. VICTORY!';
            const koTitleLoss = 'K.O. Defeat';
            winnerBody = finalRewardItem
                ? `Knockout! You earned ${winnerCoins} coins and won a ${finalRewardItem.tier} ${finalRewardItem.name}!`
                : `Knockout! You earned ${winnerCoins} bonus coins.`;
            loserBody = `You got knocked out! You earned ${loserCoins} coins.`;
            winImageUrl = `${baseUrl}/public/ko-icon.png`;
            lossImageUrl = `${baseUrl}/public/lose-icon.png`;

            if (winnerId && !winnerId.startsWith('bot_')) sendNotificationToUser(winnerId, koTitleWin, winnerBody, winImageUrl);
            if (loserId && !loserId.startsWith('bot_')) sendNotificationToUser(loserId, koTitleLoss, loserBody, lossImageUrl);

        } else if (result === 'WIN') {
            const winTitleWin = 'Victory!';
            const winTitleLoss = 'Battle Lost';
            winnerBody = finalRewardItem
                ? `You won! Earned ${winnerCoins} coins and a ${finalRewardItem.tier} ${finalRewardItem.name}!`
                : `Congratulations! You won and earned ${winnerCoins} coins!`;
            loserBody = `You lost but earned ${loserCoins} coins.`;
            winImageUrl = `${baseUrl}/public/win-icon.png`;
            lossImageUrl = `${baseUrl}/public/lose-icon.png`;

            if (winnerId && !winnerId.startsWith('bot_')) sendNotificationToUser(winnerId, winTitleWin, winnerBody, winImageUrl);
            if (loserId && !loserId.startsWith('bot_')) sendNotificationToUser(loserId, winTitleLoss, loserBody, lossImageUrl);
        }

        // Cleanup RTDB after delay
        const rtdbRef = admin.database().ref(`games/${gameId}`);
        setTimeout(() => {
            rtdbRef.remove().catch(err => console.error("Error removing game node:", err));
        }, 60000);

    } catch (error) {
        console.error(`[endBattle Cleanup] Error:`, error);
    }
};

export const endBattle = async (req, res) => {
    const { gameId, player1FinalScore, player2FinalScore } = req.body;
    console.log("[endBattle] --- START ---");
    console.log(`[endBattle] Request received for gameId: ${gameId}. Scores: P1=${player1FinalScore}, P2=${player2FinalScore}`);
    console.log('[endBattle] Request body:', JSON.stringify(req.body));
    if (!gameId) return res.status(400).json({ error: "Game ID is required" });


    try {
        const rtdbRef = admin.database().ref(`games/${gameId}`);
        const [snapshot, battleDetails] = await Promise.all([
            rtdbRef.once("value"),
            BattleModel.findById(gameId)
        ]);

        if (!snapshot.exists() || !battleDetails) {
            console.log('[endBattle] Battle not found in RTDB or MongoDB.', { exists: snapshot.exists(), battleDetails });
            return res.status(404).json({ error: "Battle not found." });
        }
        const battleData = snapshot.val();
        console.log('[endBattle] RTDB battleData:', JSON.stringify(battleData));
        console.log('[endBattle] MongoDB battleDetails:', JSON.stringify(battleDetails));
        const player1Id = battleData?.player1Id;
        const player2Id = battleData?.player2Id;

        const gameType = battleDetails.gameType;
        const p1Score = player1FinalScore ?? battleData.player1Score ?? 0;
        const p2Score = player2FinalScore ?? battleData.player2Score ?? 0;
        console.log(`[endBattle] Calculated scores: p1Score=${p1Score}, p2Score=${p2Score}`);

        // Use win_steps from remote config
        const winSteps = getWinSteps();
        console.log(`[endBattle] winSteps from remote config: ${winSteps}`);
        let winnerId = null, loserId = null, result = "DRAW", isKnockout = false;
        let winnerCoins = 0, loserCoins = 0;

        // Determine winner based on win_steps
        if (p1Score >= winSteps && p2Score >= winSteps) {
            // Both reached in same update or both >= winSteps: draw
            result = "DRAW";
            console.log('[endBattle] Both players reached winSteps. Result: DRAW');
        } else if (p1Score >= winSteps) {
            result = "WIN";
            winnerId = player1Id;
            loserId = player2Id;
            console.log(`[endBattle] Player 1 (${player1Id}) wins. Result: WIN`);
        } else if (p2Score >= winSteps) {
            result = "WIN";
            winnerId = player2Id;
            loserId = player1Id;
            console.log(`[endBattle] Player 2 (${player2Id}) wins. Result: WIN`);
        } else {
            result ="LOSE";
            console.log('[endBattle] Neither player reached winSteps. Result: LOSE');
        }

        // Calculate Coins (update logic for BOT battles as per new table)
        if (gameType === 'FRIEND') {
            const pot = p1Score + p2Score;
            if (result === "DRAW") {
                winnerCoins = Math.floor(pot / 2);
                loserCoins = Math.ceil(pot / 2);
                console.log(`[endBattle] FRIEND battle DRAW. pot=${pot}, winnerCoins=${winnerCoins}, loserCoins=${loserCoins}`);
            } else {
                winnerCoins = pot;
                loserCoins = 0;
                console.log(`[endBattle] FRIEND battle WIN. pot=${pot}, winnerCoins=${winnerCoins}, loserCoins=${loserCoins}`);
            }
        } else if (gameType === 'BOT') {
            // Determine bot type for reward
            let botId = null;
            if (player1Id && player1Id.startsWith('bot_')) botId = player1Id;
            if (player2Id && player2Id.startsWith('bot_')) botId = player2Id;
            let botType = null;
            if (botId) {
                const botObj = BotService.getBotById(botId);
                botType = botObj ? botObj.type : null;
            }
            // Set reward based on bot type
            const botRewards = {
                PAWN: 1000,
                BISHOP: 1500,
                ROOK: 2000,
                KNIGHT: 2500,
                QUEEN: 3000
            };
            if (result === "WIN") {
                
                winnerCoins = botType && botRewards[botType] ? botRewards[botType] : 1000;
                loserCoins = 0;
                console.log(`[endBattle] BOT battle WIN. botType=${botType}, winnerCoins=${winnerCoins}`);
            } else {
                
                winnerCoins = 0;
                loserCoins = 0;
                console.log(`[endBattle] BOT battle DRAW/LOSE. botType=${botType}, winnerCoins=${winnerCoins}, loserCoins=${loserCoins}`);
            }
        } else {
           
            if (result === "WIN") {
                const winnerScore = winnerId === player1Id ? p1Score : p2Score;
                const loserScore = loserId === player1Id ? p1Score : p2Score;
                winnerCoins = winnerScore + 1000;
                loserCoins = loserScore;
                console.log(`[endBattle] ${gameType} battle WIN. winnerId=${winnerId}, winnerScore=${winnerScore}, winnerCoins=${winnerCoins}, loserId=${loserId}, loserScore=${loserScore}, loserCoins=${loserCoins}`);
            } else {
                winnerCoins = p1Score;
                loserCoins = p2Score;
                console.log(`[endBattle] ${gameType} battle DRAW/LOSE. winnerCoins=${winnerCoins}, loserCoins=${loserCoins}`);
            }
        }

        const updatePromises = [];
        let finalRewardItem = null;

        // Update Winner Stats & Rewards
        if (result === 'WIN' && winnerId && !winnerId.startsWith('bot_')) {
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
            console.log('[endBattle] Winner update payload:', JSON.stringify(winnerUpdatePayload));
        }

        // Update Loser Stats
        if (result === 'WIN' && loserId && !loserId.startsWith('bot_')) {
            const loserUpdatePayload = {
                $inc: {
                    coins: loserCoins,
                    'stats.totalBattles': 1
                }
            };
            updatePromises.push(UserModel.findOneAndUpdate({ uid: loserId }, loserUpdatePayload));
            console.log('[endBattle] Loser update payload:', JSON.stringify(loserUpdatePayload));
        }

        // Update Draw Stats
        if (result === 'DRAW') {
            if (!player1Id.startsWith('bot_')) {
                const drawP1Payload = { $inc: { coins: winnerCoins, 'stats.totalBattles': 1 } };
                updatePromises.push(UserModel.findOneAndUpdate({ uid: player1Id }, drawP1Payload));
                console.log('[endBattle] Draw update payload for player1:', JSON.stringify(drawP1Payload));
            }
            if (!player2Id.startsWith('bot_')) {
                const drawP2Payload = { $inc: { coins: loserCoins, 'stats.totalBattles': 1 } };
                updatePromises.push(UserModel.findOneAndUpdate({ uid: player2Id }, drawP2Payload));
                console.log('[endBattle] Draw update payload for player2:', JSON.stringify(drawP2Payload));
            }
        }
        if(result === 'LOSE') {
            // Both players lose: increment totalBattles for both, add 0 coins
            if (player1Id && !player1Id.startsWith('bot_')) {
                const loseP1Payload = { $inc: { coins: loserCoins, 'stats.totalBattles': 1 } };
                updatePromises.push(UserModel.findOneAndUpdate({ uid: player1Id }, loseP1Payload));
                console.log('[endBattle] Lose update payload for player1:', JSON.stringify(loseP1Payload));
            }
            if (player2Id && !player2Id.startsWith('bot_')) {
                const loseP2Payload = { $inc: { coins: loserCoins, 'stats.totalBattles': 1 } };
                updatePromises.push(UserModel.findOneAndUpdate({ uid: player2Id }, loseP2Payload));
                console.log('[endBattle] Lose update payload for player2:', JSON.stringify(loseP2Payload));
            }

            }

        if (updatePromises.length > 0) {
            await Promise.all(updatePromises);
            console.log('[endBattle] User stats updated in MongoDB.');
        }

        // 1. Update MongoDB
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
        console.log('[endBattle] Battle document updated in MongoDB.');

        // 2. --- CRITICAL FIX: Update RTDB SYNCHRONOUSLY HERE --- 
        // This ensures Player 2 gets the signal immediately.
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
        console.log('[endBattle] RTDB updated with final results.');

        // 3. Send Response to Player 1
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
                }
            }
        });
        console.log('[endBattle] Response sent to client.');

        // 4. Send Notifications & Cleanup (Background Task)
        // We removed the RTDB update from inside this function since we did it above
        sendNotificationsOnlyAndCleanup(gameId, result, player1Id, player2Id, winnerId, loserId, finalRewardItem, winnerCoins, loserCoins)
            .catch(error => {
                console.error(`[endBattle Cleanup] Error:`, error);
            });
        console.log('[endBattle] --- END ---');

    } catch (error) {
        console.error("[endBattle] Error:", error);
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

