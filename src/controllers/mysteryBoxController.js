import { openMysteryBox } from '../utils/mysteryBoxService.js';

export const openBox = async (req, res) => {
    const { userId, boxType } = req.body;

    if (!userId || !boxType) {
        return res.status(400).json({ error: 'User ID and box type are required.' });
    }

    try {
        const result = await openMysteryBox(userId, boxType);
        res.status(200).json({ success: true, reward: result });
    } catch (error) {
        console.error(`Error opening mystery box for user ${userId}:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
};