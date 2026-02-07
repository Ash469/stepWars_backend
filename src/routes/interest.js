import express from "express";
import { getInterests } from "../controllers/interestController.js";

const router = express.Router();

router.get("/", getInterests);

export default router;
