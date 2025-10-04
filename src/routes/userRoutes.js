import express from 'express';
import { getUserProfile,getAllUsers,syncUserSteps} from '../controllers/userController.js';

const router = express.Router();


router.get('/profile/:uid', getUserProfile);
router.get("/users", getAllUsers);
router.post('/sync-steps', syncUserSteps);

export default router;