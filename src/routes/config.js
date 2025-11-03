import express from 'express';
import { adminActionLimiter } from '../middleware/rateLimiter.js';
import { refreshRemoteConfig } from '../config/remoteConfigService.js';

const router = express.Router();

const triggerConfigRefresh = async (req, res) => {
  try {
    refreshRemoteConfig(); 
    res.status(202).json({ 
      success: true, 
      message: "Config refresh triggered. Cache will be updated shortly." 
    });
  } catch (error) {
    console.error('[Config Refresh] Error triggering refresh:', error);
    res.status(500).json({ success: false, message: "Refresh failed." });
  }
};

router.get('/refresh', adminActionLimiter, triggerConfigRefresh);

export default router;