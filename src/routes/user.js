import express from 'express';
import { getUserProfile,getAllUsers,syncUserSteps,getUserRewards,getActivityHistory,updateUserProfile} from '../controllers/userController.js';

const router = express.Router();

router.get("/", getAllUsers);
router.get('/profile/:uid', getUserProfile);
router.get('/rewards/:uid', getUserRewards);
router.put('/profile/:uid', updateUserProfile);
router.post('/sync-steps', syncUserSteps);

router.get('/activity/:uid', getActivityHistory);

export default router;