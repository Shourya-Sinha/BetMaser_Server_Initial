import axios from 'axios';
import CLOG from '../Utils/CLOG.js';

const WORLD_CUP_BASE_URL = 'https://worldcup26.ir';
const JWT_TOKEN = process.env.WORLDCUP_JWT_TOKEN || ''; // Optional for public endpoints

class FootballDataService {
  /**
   * Get auth token for World Cup API
   */
  static async getAuthToken() {
    try {
      // If you have a registered account, login to get token
      // For public demo endpoints, this may not be needed
      if (JWT_TOKEN) return JWT_TOKEN;
      
      // Try to get public data without auth
      return null;
    } catch (error) {
      CLOG.error('Football auth error:', error.message);
      return null;
    }
  }

  /**
   * Make authenticated request to World Cup API
   */
  static async apiRequest(endpoint, params = {}) {
    try {
      const headers = {};
      
      // Add auth token if available
      const token = await this.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await axios.get(
        `${WORLD_CUP_BASE_URL}${endpoint}`,
        {
          params,
          headers,
          timeout: 10000,
        }
      );

      return response.data;
    } catch (error) {
      CLOG.error(`Football API Error [${endpoint}]:`, error.message);
      return null;
    }
  }

  /**
   * Get all World Cup matches
   */
  static async getAllMatches() {
    CLOG.info('Fetching World Cup 2026 matches...');
    
    // Try real API first
    try {
      const data = await this.apiRequest('/get/games');
      
      if (data?.games && data.games.length > 0) {
        CLOG.success(`Found ${data.games.length} World Cup matches`);
        return data.games.map(match => this.formatMatch(match));
      }
    } catch (error) {
      CLOG.warn('World Cup API failed, using mock data');
    }

    // Fallback to mock data
    return this.getMockMatches();
  }

  /**
   * Get live matches
   */
  static async getLiveMatches() {
    try {
      const data = await this.apiRequest('/get/games');
      
      if (data?.games) {
        const liveGames = data.games.filter(
          m => m.time_elapsed && 
               m.time_elapsed !== 'notstarted' && 
               m.finished === 'FALSE'
        );
        
        CLOG.success(`Found ${liveGames.length} live World Cup matches`);
        return liveGames.map(match => this.formatMatch(match));
      }
    } catch (error) {
      CLOG.warn('Live matches API failed');
    }
    
    return this.getMockMatches('live');
  }

  /**
   * Get upcoming matches
   */
  static async getUpcomingMatches() {
    try {
      const data = await this.apiRequest('/get/games');
      
      if (data?.games) {
        const upcoming = data.games.filter(
          m => m.time_elapsed === 'notstarted' && m.finished === 'FALSE'
        );
        
        return upcoming.map(match => this.formatMatch(match));
      }
    } catch (error) {
      CLOG.warn('Upcoming matches API failed');
    }
    
    return this.getMockMatches('upcoming');
  }

  /**
   * Get completed matches
   */
  static async getCompletedMatches() {
    try {
      const data = await this.apiRequest('/get/games');
      
      if (data?.games) {
        const completed = data.games.filter(m => m.finished === 'TRUE');
        return completed.map(match => this.formatMatch(match));
      }
    } catch (error) {
      CLOG.warn('Completed matches API failed');
    }
    
    return this.getMockMatches('completed');
  }

  /**
   * Get all teams
   */
  static async getTeams() {
    try {
      const data = await this.apiRequest('/get/teams');
      return data || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get groups standings
   */
  static async getGroups() {
    try {
      const data = await this.apiRequest('/get/groups');
      return data || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get stadiums
   */
  static async getStadiums() {
    try {
      const data = await this.apiRequest('/get/stadiums');
      return data || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Format match data to our standard format
   */
  static formatMatch(match) {
    let status = 'upcoming';
    if (match.finished === 'TRUE') status = 'completed';
    else if (match.time_elapsed && match.time_elapsed !== 'notstarted') status = 'live';

    return {
      id: `football-${match.id}`,
      apiId: match.id,
      name: `${match.home_team_name_en || 'TBD'} vs ${match.away_team_name_en || 'TBD'}`,
      type: 'football',
      status: status,
      source: 'api',
      teams: {
        home: match.home_team_name_en || match.home_team_label || 'TBD',
        away: match.away_team_name_en || match.away_team_label || 'TBD',
        homeShort: match.home_team_name_en?.substring(0, 4).toUpperCase() || 'TBD',
        awayShort: match.away_team_name_en?.substring(0, 4).toUpperCase() || 'TBD',
      },
      score: {
        display: match.time_elapsed === 'notstarted' 
          ? 'Match not started'
          : `${match.home_team_name_en}: ${match.home_score} - ${match.away_score} :${match.away_team_name_en}`,
        home: match.home_score || '0',
        away: match.away_score || '0',
        elapsed: match.time_elapsed || 'notstarted',
      },
      group: match.group || '',
      matchday: match.matchday || '',
      stage: match.type || 'group',
      venue: match.stadium_id ? `Stadium ${match.stadium_id}` : 'TBD',
      date: match.local_date || 'TBD',
      finished: match.finished === 'TRUE',
      entryFee: this.getEntryFee(match.type),
      prizePool: this.getPrizePool(match.type),
      players: [],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get mock World Cup matches for fallback
   */
  static getMockMatches(status = null) {
    const matches = [
      {
        id: 'football-mock-1',
        apiId: 'mock-fb-1',
        name: 'Mexico vs South Africa',
        type: 'football',
        status: 'upcoming',
        source: 'mock',
        teams: { home: 'Mexico', away: 'South Africa', homeShort: 'MEX', awayShort: 'RSA' },
        score: { display: 'Opening Match - June 11, 2026', home: '0', away: '0', elapsed: 'notstarted' },
        group: 'A',
        matchday: '1',
        stage: 'group',
        venue: 'Estadio Azteca, Mexico City',
        date: '06/11/2026 13:00',
        entryFee: 50,
        prizePool: 200000,
        players: [],
      },
      {
        id: 'football-mock-2',
        apiId: 'mock-fb-2',
        name: 'Brazil vs Morocco',
        type: 'football',
        status: 'upcoming',
        source: 'mock',
        teams: { home: 'Brazil', away: 'Morocco', homeShort: 'BRA', awayShort: 'MAR' },
        score: { display: 'Group C - June 12, 2026', home: '0', away: '0', elapsed: 'notstarted' },
        group: 'C',
        matchday: '1',
        stage: 'group',
        venue: 'SoFi Stadium, Los Angeles',
        date: '06/12/2026 16:00',
        entryFee: 40,
        prizePool: 150000,
        players: [],
      },
      {
        id: 'football-mock-3',
        apiId: 'mock-fb-3',
        name: 'Argentina vs Algeria',
        type: 'football',
        status: 'upcoming',
        source: 'mock',
        teams: { home: 'Argentina', away: 'Algeria', homeShort: 'ARG', awayShort: 'ALG' },
        score: { display: 'Group J - June 13, 2026', home: '0', away: '0', elapsed: 'notstarted' },
        group: 'J',
        matchday: '1',
        stage: 'group',
        venue: 'MetLife Stadium, New Jersey',
        date: '06/13/2026 20:00',
        entryFee: 60,
        prizePool: 250000,
        players: [],
      },
      {
        id: 'football-mock-4',
        apiId: 'mock-fb-4',
        name: 'Germany vs France',
        type: 'football',
        status: 'live',
        source: 'mock',
        teams: { home: 'Germany', away: 'France', homeShort: 'GER', awayShort: 'FRA' },
        score: { display: 'GER 2 - 1 FRA (65\')', home: '2', away: '1', elapsed: '65min' },
        group: 'E/I',
        matchday: '2',
        stage: 'group',
        venue: 'AT&T Stadium, Dallas',
        date: '06/20/2026 18:00',
        entryFee: 75,
        prizePool: 300000,
        players: [],
      },
      {
        id: 'football-mock-5',
        apiId: 'mock-fb-5',
        name: 'Spain vs England',
        type: 'football',
        status: 'completed',
        source: 'mock',
        teams: { home: 'Spain', away: 'England', homeShort: 'ESP', awayShort: 'ENG' },
        score: { display: 'ESP 3 - 2 ENG (FT)', home: '3', away: '2', elapsed: 'finished' },
        group: 'H/L',
        matchday: '1',
        stage: 'group',
        venue: 'Hard Rock Stadium, Miami',
        date: '06/14/2026 20:00',
        entryFee: 0,
        prizePool: 0,
        players: [],
      },
      {
        id: 'football-mock-6',
        apiId: 'mock-fb-6',
        name: 'Portugal vs Colombia',
        type: 'football',
        status: 'upcoming',
        source: 'mock',
        teams: { home: 'Portugal', away: 'Colombia', homeShort: 'POR', awayShort: 'COL' },
        score: { display: 'Group K - June 14, 2026', home: '0', away: '0', elapsed: 'notstarted' },
        group: 'K',
        matchday: '1',
        stage: 'group',
        venue: "Levi's Stadium, San Francisco",
        date: '06/14/2026 16:00',
        entryFee: 45,
        prizePool: 180000,
        players: [],
      },
    ];

    if (status) {
      return matches.filter(m => m.status === status);
    }
    return matches;
  }

  static getEntryFee(stage) {
    const fees = { 'group': 30, 'r32': 50, 'r16': 75, 'qf': 100, 'sf': 150, 'final': 200 };
    return fees[stage] || 30;
  }

  static getPrizePool(stage) {
    const pools = { 'group': 100000, 'r32': 200000, 'r16': 350000, 'qf': 500000, 'sf': 750000, 'final': 1000000 };
    return pools[stage] || 100000;
  }
}

export default FootballDataService;