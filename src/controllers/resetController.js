import  {runDailyReset} from '../utils/dailyReset.js';

export const triggerDailyReset = async (req, res) => {
  try {
    console.log('--- [MANUAL TRIGGER] Starting Daily Reset ---');
    await runDailyReset();
    console.log('--- [MANUAL TRIGGER] Daily Reset Finished ---');
    res.status(200).json({ success: true, message: "Manual daily reset completed successfully." });
  } catch (error) {
    console.error('[MANUAL TRIGGER] An error occurred:', error);
    res.status(500).json({ success: false, message: "Manual reset failed." });
  }
};
