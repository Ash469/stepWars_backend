// This service provides static methods to manage bot data.
const BOTS = [
  { id: 'bot_pawn', name: 'Pawn Bot', type: 'PAWN' },
  { id: 'bot_bishop', name: 'Bishop Bot', type: 'BISHOP' },
  { id: 'bot_rook', name: 'Rook Bot', type: 'ROOK' },
  { id: 'bot_knight', name: 'Knight Bot', type: 'KNIGHT' },
  { id: 'bot_queen', name: 'Queen Bot', type: 'QUEEN' },
];

class BotService {
  /**
   * Selects a random bot from the available list.
   * @returns {{id: string, name: string, type: string}} A random bot object.
   */
  static selectRandomBot() {
    return BOTS[Math.floor(Math.random() * BOTS.length)];
  }

  /**
   * Finds a bot by its unique ID.
   * @param {string} botId - The ID of the bot to find (e.g., 'bot_pawn').
   * @returns {{id: string, name: string, type: string} | null} The bot object or null if not found.
   */
  static getBotById(botId) {
    return BOTS.find(bot => bot.id === botId) || null;
  }
}

export default BotService;

