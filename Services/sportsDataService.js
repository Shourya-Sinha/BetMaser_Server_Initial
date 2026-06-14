import CricketDataService from './cricketDataService.js';
import CLOG from '../Utils/CLOG.js';

class SportsDataService {
  /**
   * Get all live games (cricket + small games)
   */
  static async getAllLiveGames(type = 'international') {
    const cricket = await CricketDataService.getLiveMatches(type);
    
    CLOG.success(`Live games: ${cricket.length} cricket matches`);
    
    return [...cricket];
  }

  /**
   * Get all upcoming games
   */
  static async getAllUpcomingGames(type = 'international') {
    const cricket = await CricketDataService.getUpcomingMatches(type);
    
    CLOG.success(`Upcoming games: ${cricket.length} cricket matches`);
    
    return [...cricket];
  }

  /**
   * Get all completed games
   */
  static async getCompletedGames(type = 'international') {
    const cricket = await CricketDataService.getRecentMatches(type);
    
    return [...cricket];
  }

  /**
   * Get match score/details
   */
  static async getMatchScore(matchId) {
    // Remove 'cricket-' prefix if present
    const id = matchId.replace('cricket-', '');
    return await CricketDataService.getMatchScore(id);
  }

  /**
   * Get all games (live + upcoming + completed + small games)
   */
  static async getAllGames(type = 'international') {
    const cricketMatches = await CricketDataService.getAllMatches(type);
    const smallGames = getSmallGames();
    
    return [...cricketMatches, ...smallGames];
  }
}

/**
 * Small games that are always available
 */
function getSmallGames() {
  return [
    {
      id: 'teenpatti-classic',
      name: 'Teen Patti Classic',
      type: 'teenpatti',
      status: 'live',
      icon: 'cards-playing-outline',
      minPlayers: 2,
      maxPlayers: 6,
      entryFee: 50,
      prizePool: 500,
      color: '#4A148C',
    },
    {
      id: 'teenpatti-premium',
      name: 'Teen Patti Premium',
      type: 'teenpatti',
      status: 'live',
      icon: 'cards-playing-outline',
      minPlayers: 2,
      maxPlayers: 6,
      entryFee: 200,
      prizePool: 2000,
      color: '#6A1B9A',
    },
    {
      id: 'ludo-king',
      name: 'Ludo King',
      type: 'ludo',
      status: 'live',
      icon: 'dice-multiple',
      minPlayers: 2,
      maxPlayers: 4,
      entryFee: 30,
      prizePool: 300,
      color: '#FF6F00',
    },
    {
      id: 'ludo-premium',
      name: 'Ludo Premium',
      type: 'ludo',
      status: 'live',
      icon: 'dice-multiple',
      minPlayers: 2,
      maxPlayers: 4,
      entryFee: 150,
      prizePool: 1500,
      color: '#E65100',
    },
    {
      id: 'poker-texas',
      name: "Texas Hold'em",
      type: 'poker',
      status: 'live',
      icon: 'cards-outline',
      minPlayers: 2,
      maxPlayers: 9,
      entryFee: 100,
      prizePool: 1000,
      color: '#B71C1C',
    },
    {
      id: 'rummy-classic',
      name: 'Rummy Classic',
      type: 'rummy',
      status: 'live',
      icon: 'cards',
      minPlayers: 2,
      maxPlayers: 6,
      entryFee: 40,
      prizePool: 400,
      color: '#0D47A1',
    },
  ];
}

export default SportsDataService;