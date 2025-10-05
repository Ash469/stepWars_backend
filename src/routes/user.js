import express from 'express';
import { getUserProfile,getAllUsers,syncUserSteps,getUserRewards,triggerDailyReset,getActivityHistory} from '../controllers/userController.js';

const router = express.Router();

router.get("/", getAllUsers);
router.get('/profile/:uid', getUserProfile);
router.get('/rewards/:uid', getUserRewards);
router.post('/sync-steps', syncUserSteps);
router.post('/manual-daily-reset', triggerDailyReset);
router.get('/activity/:uid', getActivityHistory);

export default router;