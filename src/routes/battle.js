import express from "express";
import { createBotBattle, createFriendBattle, joinFriendBattle } from "../controllers/battleController.js";
import { endBattle } from "../controllers/battleController.js";

const router = express.Router();

router.post("/bot", createBotBattle);

router.post("/friend/create", createFriendBattle);

router.post("/friend/join", joinFriendBattle);

router.post("/end",endBattle)

export default router;
