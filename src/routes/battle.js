import express from "express";
import { 
    createBotBattle, 
    createFriendBattle, 
    joinFriendBattle, 
    cancelFriendBattle,
    createPvpBattle, 
    endBattle,
    useMultiplier 
} from "../controllers/battleController.js";
import { actionLimiter } from '../middleware/rateLimiter.js';

router.post("/pvp/create", actionLimiter, createPvpBattle);
router.post("/bot", actionLimiter, createBotBattle);
router.post("/friend/create", actionLimiter, createFriendBattle);
router.post("/friend/join", actionLimiter, joinFriendBattle);
router.post("/friend/cancel", actionLimiter, cancelFriendBattle);
router.post("/end", actionLimiter, endBattle);
router.post('/use-multiplier', actionLimiter, useMultiplier);

export default router;