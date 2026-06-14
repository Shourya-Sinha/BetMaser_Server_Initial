import axios from 'axios';
import CLOG from '../Utils/Clog.js';

const CRICAPI_KEY = process.env.CRICAPI_KEY || 'f4f3d096-e150-4273-a46b-156361ca0583';
const CRICAPI_BASE_URL = 'https://api.cricapi.com/v1';

class CricketDataService {
  /**
   * Fetch live cricket matches
   */
  // static async getLiveMatches() {
  //   try {
  //     CLOG.info('Fetching live cricket matches from CricAPI...');

  //     const response = await axios.get(
  //       `${CRICAPI_BASE_URL}/currentMatches`,
  //       {
  //         params: { apikey: CRICAPI_KEY, offset: 0 },
  //         timeout: 15000,
  //       }
  //     );
  //     console.log('🔍 CricAPI Response Status:', response.status);
  //     console.log('🔍 CricAPI Total Data:', response.data?.data?.length || 0, 'matches');
  //     if (response.data?.data) {
  //       // Filter only live matches (started but not ended)
  //       const liveMatches = response.data.data.filter(
  //         match => match.matchStarted && !match.matchEnded
  //       );

  //       CLOG.success(`Found ${liveMatches.length} live matches`);

  //       // ✅ Format each match properly
  //       const formatted = liveMatches.map(match => this.formatMatch(match, 'live'));

  //       // ✅ Debug first match
  //       if (formatted.length > 0) {
  //         console.log('📊 First Live Match:', formatted[0].name);
  //         console.log('📊 Teams:', formatted[0].teams);
  //       }

  //       return formatted;
  //     }
  //     return [];
  //   } catch (error) {
  //     CLOG.error('CricAPI Live Error:', error.response?.data?.message || error.message);
  //     return [];
  //   }
  // }
    static async getLiveMatches() {
    try {
      CLOG.info('Fetching live cricket matches from CricAPI...');
      
      const response = await axios.get(
        `${CRICAPI_BASE_URL}/currentMatches`,
        {
          params: { apikey: CRICAPI_KEY, offset: 0 },
          timeout: 15000,
        }
      );

      console.log('🔍 CricAPI Response Status:', response.status);
      console.log('🔍 CricAPI Total Data:', response.data?.data?.length || 0, 'matches');

      if (response.data?.data && response.data.data.length > 0) {
        const liveMatches = response.data.data.filter(
          match => match.matchStarted && !match.matchEnded
        );
        
        CLOG.success(`Found ${liveMatches.length} live matches from API`);
        
        if (liveMatches.length > 0) {
          return liveMatches.map(match => this.formatMatch(match, 'live'));
        }
      }
      
      // ✅ API returned 0 live matches - use mock data
      console.log('⚠️ No live matches from API, using mock data');
      return this.getMockMatches('live');
      
    } catch (error) {
      CLOG.error('CricAPI Live Error:', error.response?.data?.message || error.message);
      console.log('⚠️ API error, using mock data');
      return this.getMockMatches('live');
    }
  }

  /**
   * Fetch upcoming cricket matches
   */
  // static async getUpcomingMatches() {
  //   try {
  //     CLOG.info('Fetching upcoming cricket matches from CricAPI...');

  //     const response = await axios.get(
  //       `${CRICAPI_BASE_URL}/currentMatches`,
  //       {
  //         params: { apikey: CRICAPI_KEY, offset: 0 },
  //         timeout: 15000,
  //       }
  //     );

  //     if (response.data?.data) {
  //       // Filter upcoming matches (not started)
  //       const upcomingMatches = response.data.data.filter(
  //         match => !match.matchStarted
  //       );

  //       CLOG.success(`Found ${upcomingMatches.length} upcoming matches`);

  //       const formatted = upcomingMatches.map(match => this.formatMatch(match, 'upcoming'));

  //       if (formatted.length > 0) {
  //         console.log('📊 First Upcoming Match:', formatted[0].name);
  //       }

  //       return formatted;
  //     }
  //     return [];
  //   } catch (error) {
  //     CLOG.error('CricAPI Upcoming Error:', error.response?.data?.message || error.message);
  //     return [];
  //   }
  // }
  static async getUpcomingMatches() {
    try {
      CLOG.info('Fetching upcoming cricket matches from CricAPI...');
      
      const response = await axios.get(
        `${CRICAPI_BASE_URL}/currentMatches`,
        {
          params: { apikey: CRICAPI_KEY, offset: 0 },
          timeout: 15000,
        }
      );

      if (response.data?.data && response.data.data.length > 0) {
        const upcomingMatches = response.data.data.filter(
          match => !match.matchStarted
        );
        
        CLOG.success(`Found ${upcomingMatches.length} upcoming matches from API`);
        
        if (upcomingMatches.length > 0) {
          return upcomingMatches.map(match => this.formatMatch(match, 'upcoming'));
        }
      }
      
      // ✅ API returned 0 upcoming matches - use mock data
      console.log('⚠️ No upcoming matches from API, using mock data');
      return this.getMockMatches('upcoming');
      
    } catch (error) {
      CLOG.error('CricAPI Upcoming Error:', error.response?.data?.message || error.message);
      return this.getMockMatches('upcoming');
    }
  }


  /**
   * Fetch completed matches
   */
  // static async getRecentMatches() {
  //   try {
  //     CLOG.info('Fetching completed cricket matches from CricAPI...');

  //     const response = await axios.get(
  //       `${CRICAPI_BASE_URL}/currentMatches`,
  //       {
  //         params: { apikey: CRICAPI_KEY, offset: 0 },
  //         timeout: 15000,
  //       }
  //     );

  //     if (response.data?.data) {
  //       const completedMatches = response.data.data.filter(
  //         match => match.matchEnded
  //       );

  //       CLOG.success(`Found ${completedMatches.length} completed matches`);
  //       return completedMatches.map(match => this.formatMatch(match, 'completed'));
  //     }
  //     return [];
  //   } catch (error) {
  //     CLOG.error('CricAPI Recent Error:', error.response?.data?.message || error.message);
  //     return [];
  //   }
  // }
   static async getRecentMatches() {
    try {
      CLOG.info('Fetching completed cricket matches from CricAPI...');
      
      const response = await axios.get(
        `${CRICAPI_BASE_URL}/currentMatches`,
        {
          params: { apikey: CRICAPI_KEY, offset: 0 },
          timeout: 15000,
        }
      );

      if (response.data?.data && response.data.data.length > 0) {
        const completedMatches = response.data.data.filter(
          match => match.matchEnded
        );
        
        if (completedMatches.length > 0) {
          return completedMatches.map(match => this.formatMatch(match, 'completed'));
        }
      }
      
      // ✅ Use mock completed matches
      return this.getMockMatches('completed');
      
    } catch (error) {
      CLOG.error('CricAPI Recent Error:', error.message);
      return this.getMockMatches('completed');
    }
  }


  /**
   * Get all matches
   */
  // static async getAllMatches() {
  //   try {
  //     CLOG.info('Fetching all cricket matches from CricAPI...');

  //     const response = await axios.get(
  //       `${CRICAPI_BASE_URL}/currentMatches`,
  //       {
  //         params: { apikey: CRICAPI_KEY, offset: 0 },
  //         timeout: 15000,
  //       }
  //     );

  //     if (response.data?.data) {
  //       const allMatches = response.data.data.map(match => {
  //         let status = 'upcoming';
  //         if (match.matchStarted && !match.matchEnded) status = 'live';
  //         else if (match.matchEnded) status = 'completed';
  //         return this.formatMatch(match, status);
  //       });

  //       CLOG.success(`Total matches: ${allMatches.length}`);
  //       return allMatches;
  //     }
  //     return [];
  //   } catch (error) {
  //     CLOG.error('CricAPI All Error:', error.response?.data?.message || error.message);
  //     return [];
  //   }
  // }
   static async getAllMatches() {
    try {
      CLOG.info('Fetching all cricket matches from CricAPI...');
      
      const response = await axios.get(
        `${CRICAPI_BASE_URL}/currentMatches`,
        {
          params: { apikey: CRICAPI_KEY, offset: 0 },
          timeout: 15000,
        }
      );

      if (response.data?.data && response.data.data.length > 0) {
        const allMatches = response.data.data.map(match => {
          let status = 'upcoming';
          if (match.matchStarted && !match.matchEnded) status = 'live';
          else if (match.matchEnded) status = 'completed';
          return this.formatMatch(match, status);
        });
        
        CLOG.success(`Total matches from API: ${allMatches.length}`);
        return allMatches;
      }
      
      // ✅ API empty - use all mock matches
      console.log('⚠️ No matches from API, using all mock data');
      return [
        ...this.getMockMatches('live'),
        ...this.getMockMatches('upcoming'),
        ...this.getMockMatches('completed'),
      ];
      
    } catch (error) {
      CLOG.error('CricAPI All Error:', error.message);
      return [
        ...this.getMockMatches('live'),
        ...this.getMockMatches('upcoming'),
        ...this.getMockMatches('completed'),
      ];
    }
  }

  static getMockMatches(status) {
    const allMocks = [
      // ============ LIVE MATCHES ============
      {
        id: 'cricket-mock-live-1',
        apiId: 'mock-live-1',
        name: 'India vs Australia - 3rd T20I',
        type: 'cricket',
        status: 'live',
        source: 'mock',
        teams: {
          home: 'India',
          away: 'Australia',
          homeShort: 'IND',
          awayShort: 'AUS',
        },
        teamInfo: [
          { name: 'India', shortname: 'IND', img: 'https://g.cricapi.com/iapi/32-637877061328728555.webp?w=48' },
          { name: 'Australia', shortname: 'AUS', img: 'https://g.cricapi.com/iapi/7-637877070884402012.webp?w=48' },
        ],
        score: {
          display: 'IND: 186/4 (17.2 ov) | AUS: 120/3 (12.0 ov)',
          details: [
            { inning: 'India Inning 1', runs: 186, wickets: 4, overs: 17.2 },
            { inning: 'Australia Inning 1', runs: 120, wickets: 3, overs: 12.0 },
          ],
        },
        venue: 'Wankhede Stadium, Mumbai',
        date: new Date().toISOString().split('T')[0],
        dateTimeGMT: new Date().toISOString(),
        startTime: new Date().toISOString(),
        matchType: 't20',
        overview: 'India need 45 runs from 18 balls',
        fantasyEnabled: true,
        hasSquad: false,
        entryFee: 49,
        prizePool: 500000,
        players: [],
      },
      {
        id: 'cricket-mock-live-2',
        apiId: 'mock-live-2',
        name: 'England vs Pakistan - 2nd ODI',
        type: 'cricket',
        status: 'live',
        source: 'mock',
        teams: {
          home: 'England',
          away: 'Pakistan',
          homeShort: 'ENG',
          awayShort: 'PAK',
        },
        teamInfo: [
          { name: 'England', shortname: 'ENG', img: 'https://g.cricapi.com/iapi/24-637877067109151578.webp?w=48' },
          { name: 'Pakistan', shortname: 'PAK', img: 'https://g.cricapi.com/iapi/67-637877074931980375.webp?w=48' },
        ],
        score: {
          display: 'ENG: 278/7 (48.0 ov) | PAK: 156/4 (32.0 ov)',
          details: [
            { inning: 'England Inning 1', runs: 278, wickets: 7, overs: 48.0 },
            { inning: 'Pakistan Inning 1', runs: 156, wickets: 4, overs: 32.0 },
          ],
        },
        venue: "Lord's, London",
        date: new Date().toISOString().split('T')[0],
        dateTimeGMT: new Date().toISOString(),
        startTime: new Date().toISOString(),
        matchType: 'odi',
        overview: 'Pakistan need 123 runs from 18 overs',
        fantasyEnabled: true,
        hasSquad: true,
        entryFee: 39,
        prizePool: 300000,
        players: [],
      },
      // ============ UPCOMING MATCHES ============
      {
        id: 'cricket-mock-up-1',
        apiId: 'mock-up-1',
        name: 'CSK vs MI - IPL 2025 Final',
        type: 'cricket',
        status: 'upcoming',
        source: 'mock',
        teams: {
          home: 'Chennai Super Kings',
          away: 'Mumbai Indians',
          homeShort: 'CSK',
          awayShort: 'MI',
        },
        teamInfo: [
          { name: 'Chennai Super Kings', shortname: 'CSK', img: 'https://h.cricapi.com/img/icon512.png' },
          { name: 'Mumbai Indians', shortname: 'MI', img: 'https://h.cricapi.com/img/icon512.png' },
        ],
        score: { display: 'Match starts tomorrow at 7:30 PM IST', details: [] },
        venue: 'M.A. Chidambaram Stadium, Chennai',
        date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        dateTimeGMT: new Date(Date.now() + 86400000).toISOString(),
        startTime: new Date(Date.now() + 86400000).toISOString(),
        matchType: 't20',
        overview: 'IPL 2025 Grand Finale',
        fantasyEnabled: true,
        hasSquad: true,
        entryFee: 99,
        prizePool: 1000000,
        players: [],
      },
      {
        id: 'cricket-mock-up-2',
        apiId: 'mock-up-2',
        name: 'New Zealand vs South Africa - 1st Test',
        type: 'cricket',
        status: 'upcoming',
        source: 'mock',
        teams: {
          home: 'New Zealand',
          away: 'South Africa',
          homeShort: 'NZ',
          awayShort: 'SA',
        },
        teamInfo: [
          { name: 'New Zealand', shortname: 'NZ', img: 'https://g.cricapi.com/iapi/58-637877077173296488.webp?w=48' },
          { name: 'South Africa', shortname: 'SA', img: 'https://g.cricapi.com/iapi/83-637877067733114809.webp?w=48' },
        ],
        score: { display: 'Match starts in 3 days', details: [] },
        venue: 'Basin Reserve, Wellington',
        date: new Date(Date.now() + 259200000).toISOString().split('T')[0],
        dateTimeGMT: new Date(Date.now() + 259200000).toISOString(),
        startTime: new Date(Date.now() + 259200000).toISOString(),
        matchType: 'test',
        overview: '1st Test Match - Day 1',
        fantasyEnabled: true,
        hasSquad: false,
        entryFee: 75,
        prizePool: 500000,
        players: [],
      },
      {
        id: 'cricket-mock-up-3',
        apiId: 'mock-up-3',
        name: 'India vs Pakistan - Asia Cup Final',
        type: 'cricket',
        status: 'upcoming',
        source: 'mock',
        teams: {
          home: 'India',
          away: 'Pakistan',
          homeShort: 'IND',
          awayShort: 'PAK',
        },
        teamInfo: [
          { name: 'India', shortname: 'IND', img: 'https://g.cricapi.com/iapi/32-637877061328728555.webp?w=48' },
          { name: 'Pakistan', shortname: 'PAK', img: 'https://g.cricapi.com/iapi/67-637877074931980375.webp?w=48' },
        ],
        score: { display: 'Match starts in 5 days', details: [] },
        venue: 'Dubai International Stadium',
        date: new Date(Date.now() + 432000000).toISOString().split('T')[0],
        dateTimeGMT: new Date(Date.now() + 432000000).toISOString(),
        startTime: new Date(Date.now() + 432000000).toISOString(),
        matchType: 'odi',
        overview: 'Asia Cup 2025 - The Ultimate Rivalry',
        fantasyEnabled: true,
        hasSquad: true,
        entryFee: 149,
        prizePool: 2000000,
        players: [],
      },
      // ============ COMPLETED MATCHES ============
      {
        id: 'cricket-mock-comp-1',
        apiId: 'mock-comp-1',
        name: 'India vs Sri Lanka - 2nd T20I',
        type: 'cricket',
        status: 'completed',
        source: 'mock',
        teams: {
          home: 'India',
          away: 'Sri Lanka',
          homeShort: 'IND',
          awayShort: 'SL',
        },
        teamInfo: [
          { name: 'India', shortname: 'IND', img: 'https://g.cricapi.com/iapi/32-637877061328728555.webp?w=48' },
          { name: 'Sri Lanka', shortname: 'SL', img: 'https://g.cricapi.com/iapi/83-637877067733114809.webp?w=48' },
        ],
        score: {
          display: 'IND: 212/4 (20 ov) | SL: 134/10 (17.2 ov) - India won by 78 runs',
          details: [
            { inning: 'India Inning 1', runs: 212, wickets: 4, overs: 20 },
            { inning: 'Sri Lanka Inning 1', runs: 134, wickets: 10, overs: 17.2 },
          ],
        },
        venue: 'Eden Gardens, Kolkata',
        date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
        dateTimeGMT: new Date(Date.now() - 86400000).toISOString(),
        startTime: new Date(Date.now() - 86400000).toISOString(),
        matchType: 't20',
        overview: 'India won by 78 runs',
        fantasyEnabled: false,
        hasSquad: false,
        entryFee: 0,
        prizePool: 0,
        players: [],
      },
      {
        id: 'cricket-mock-comp-2',
        apiId: 'mock-comp-2',
        name: 'Australia vs England - 5th Test',
        type: 'cricket',
        status: 'completed',
        source: 'mock',
        teams: {
          home: 'Australia',
          away: 'England',
          homeShort: 'AUS',
          awayShort: 'ENG',
        },
        teamInfo: [
          { name: 'Australia', shortname: 'AUS', img: 'https://g.cricapi.com/iapi/7-637877070884402012.webp?w=48' },
          { name: 'England', shortname: 'ENG', img: 'https://g.cricapi.com/iapi/24-637877067109151578.webp?w=48' },
        ],
        score: {
          display: 'AUS: 458 & 212 | ENG: 324 & 180 - Australia won by 166 runs',
          details: [],
        },
        venue: 'Sydney Cricket Ground',
        date: new Date(Date.now() - 172800000).toISOString().split('T')[0],
        dateTimeGMT: new Date(Date.now() - 172800000).toISOString(),
        startTime: new Date(Date.now() - 172800000).toISOString(),
        matchType: 'test',
        overview: 'Australia won by 166 runs',
        fantasyEnabled: false,
        hasSquad: false,
        entryFee: 0,
        prizePool: 0,
        players: [],
      },
    ];

    if (status) {
      return allMocks.filter(m => m.status === status);
    }
    return allMocks;
  }

    /**
   * ✅ Mock match score data
   */
  static getMockScoreData(matchId) {
    return {
      id: matchId,
      title: 'India vs Australia - 3rd T20I',
      update: 'India need 45 runs from 18 balls',
      liveScore: 'IND 186/4 (17.2) | AUS 120/3 (12.0)',
      runRate: '10.8',
      batsmanOne: { name: 'Virat Kohli', runs: '72', balls: '(42)', strikeRate: '171.4' },
      batsmanTwo: { name: 'Hardik Pandya', runs: '35', balls: '(18)', strikeRate: '194.4' },
      bowlerOne: { name: 'Mitchell Starc', overs: '3.2', runs: '38', wickets: '1', economy: '11.4' },
      bowlerTwo: { name: 'Pat Cummins', overs: '4.0', runs: '42', wickets: '2', economy: '10.5' },
    };
  }


  /**
   * ✅ FIXED: Format match data - CORRECTLY extracts team names from API array
   */
  static formatMatch(match, status) {
    // ✅ API sends teams as ARRAY: ["Team1", "Team2"]
    const teamsArray = match.teams || [];
    const teamInfoArray = match.teamInfo || [];

    // ✅ Get team names directly from the array
    const homeTeam = teamsArray[0] || 'TBD';
    const awayTeam = teamsArray[1] || 'TBD';

    // ✅ Get short names and images from teamInfo
    const homeInfo = teamInfoArray[0] || {};
    const awayInfo = teamInfoArray[1] || {};

    const homeShort = homeInfo.shortname || homeTeam.substring(0, 4).toUpperCase();
    const awayShort = awayInfo.shortname || awayTeam.substring(0, 4).toUpperCase();
    const homeImg = homeInfo.img || null;
    const awayImg = awayInfo.img || null;

    // ✅ Format score display
    const scores = match.score || [];
    let scoreDisplay = '';
    if (scores.length > 0) {
      scoreDisplay = scores.map(s => {
        const teamName = s.inning?.split(' Inning')[0]?.trim() || '';
        return `${teamName}: ${s.r}/${s.w} (${s.o} ov)`;
      }).join(' | ');
    }

    const result = {
      id: `cricket-${match.id}`,
      apiId: match.id,
      name: match.name || `${homeTeam} vs ${awayTeam}`,
      type: 'cricket',
      status: status,
      source: 'api',
      teams: {
        home: homeTeam,
        away: awayTeam,
        homeShort: homeShort,
        awayShort: awayShort,
      },
      teamInfo: [
        {
          name: homeInfo.name || homeTeam,
          shortname: homeShort,
          img: homeImg,
        },
        {
          name: awayInfo.name || awayTeam,
          shortname: awayShort,
          img: awayImg,
        },
      ],
      score: {
        display: scoreDisplay || match.status || '',
        details: scores.map(s => ({
          inning: s.inning,
          runs: s.r,
          wickets: s.w,
          overs: s.o,
        })),
      },
      venue: match.venue || 'TBD',
      date: match.date || '',
      dateTimeGMT: match.dateTimeGMT || new Date().toISOString(),
      startTime: match.dateTimeGMT || new Date().toISOString(),
      matchType: match.matchType || 't20',
      overview: match.status || '',
      fantasyEnabled: match.fantasyEnabled || false,
      hasSquad: match.hasSquad || false,
      seriesId: match.series_id,
      entryFee: this.getEntryFee(match.matchType),
      prizePool: this.getPrizePool(match.matchType),
      players: [],
      timestamp: new Date().toISOString(),
    };

    return result;
  }

  /**
   * Fetch match score/details
   */
  // static async getMatchScore(matchId) {
  //   try {
  //     const response = await axios.get(
  //       `${CRICAPI_BASE_URL}/match_info`,
  //       {
  //         params: { apikey: CRICAPI_KEY, id: matchId },
  //         timeout: 10000,
  //       }
  //     );
  //     if (response.data?.data) {
  //       return this.formatMatchInfo(response.data.data);
  //     }
  //     return null;
  //   } catch (error) {
  //     CLOG.error('Match Info Error:', error.message);
  //     return null;
  //   }
  // }
   static async getMatchScore(matchId) {
    // If it's a mock match, return mock score
    if (matchId?.startsWith('mock-')) {
      return this.getMockScoreData(matchId);
    }

    try {
      const response = await axios.get(
        `${CRICAPI_BASE_URL}/match_info`,
        {
          params: { apikey: CRICAPI_KEY, id: matchId },
          timeout: 10000,
        }
      );
      if (response.data?.data) {
        return this.formatMatchInfo(response.data.data);
      }
      return this.getMockScoreData(matchId);
    } catch (error) {
      CLOG.error('Match Info Error:', error.message);
      return this.getMockScoreData(matchId);
    }
  }

  /**
   * Fetch fantasy squad
   */
  // static async getFantasySquad(matchId) {
  //   try {
  //     const response = await axios.get(
  //       `${CRICAPI_BASE_URL}/fantasySquad`,
  //       {
  //         params: { apikey: CRICAPI_KEY, id: matchId },
  //         timeout: 10000,
  //       }
  //     );
  //     if (response.data?.data) {
  //       return this.formatSquadData(response.data.data);
  //     }
  //     return null;
  //   } catch (error) {
  //     CLOG.error('Squad Error:', error.message);
  //     return null;
  //   }
  // }

   static async getFantasySquad(matchId) {
    try {
      const response = await axios.get(
        `${CRICAPI_BASE_URL}/fantasySquad`,
        {
          params: { apikey: CRICAPI_KEY, id: matchId },
          timeout: 10000,
        }
      );
      if (response.data?.data) {
        return this.formatSquadData(response.data.data);
      }
      return null;
    } catch (error) {
      CLOG.error('Squad Error:', error.message);
      return null;
    }
  }


  // static formatMatchInfo(data) {
  //   return {
  //     id: `cricket-${data.id}`,
  //     name: data.name,
  //     status: data.status,
  //     venue: data.venue,
  //     date: data.date,
  //     matchType: data.matchType,
  //     teams: data.teams,
  //     teamInfo: data.teamInfo,
  //     score: data.score?.map(s => ({
  //       inning: s.inning,
  //       runs: s.r,
  //       wickets: s.w,
  //       overs: s.o,
  //     })),
  //   };
  // }
   static formatMatch(match, status) {
    const teamsArray = match.teams || [];
    const teamInfoArray = match.teamInfo || [];
    
    const homeTeam = teamsArray[0] || 'TBD';
    const awayTeam = teamsArray[1] || 'TBD';
    
    const homeInfo = teamInfoArray[0] || {};
    const awayInfo = teamInfoArray[1] || {};
    
    const homeShort = homeInfo.shortname || homeTeam.substring(0, 4).toUpperCase();
    const awayShort = awayInfo.shortname || awayTeam.substring(0, 4).toUpperCase();
    const homeImg = homeInfo.img || null;
    const awayImg = awayInfo.img || null;

    const scores = match.score || [];
    let scoreDisplay = '';
    if (scores.length > 0) {
      scoreDisplay = scores.map(s => {
        const teamName = s.inning?.split(' Inning')[0]?.trim() || '';
        return `${teamName}: ${s.r}/${s.w} (${s.o} ov)`;
      }).join(' | ');
    }

    return {
      id: `cricket-${match.id}`,
      apiId: match.id,
      name: match.name || `${homeTeam} vs ${awayTeam}`,
      type: 'cricket',
      status: status,
      source: match.source || 'api',
      teams: { home: homeTeam, away: awayTeam, homeShort, awayShort },
      teamInfo: [
        { name: homeInfo.name || homeTeam, shortname: homeShort, img: homeImg },
        { name: awayInfo.name || awayTeam, shortname: awayShort, img: awayImg },
      ],
      score: {
        display: scoreDisplay || match.status || '',
        details: scores.map(s => ({ inning: s.inning, runs: s.r, wickets: s.w, overs: s.o })),
      },
      venue: match.venue || 'TBD',
      date: match.date || '',
      dateTimeGMT: match.dateTimeGMT || new Date().toISOString(),
      startTime: match.dateTimeGMT || new Date().toISOString(),
      matchType: match.matchType || 't20',
      overview: match.overview || '',
      fantasyEnabled: match.fantasyEnabled || false,
      hasSquad: match.hasSquad || false,
      seriesId: match.series_id,
      entryFee: match.entryFee || this.getEntryFee(match.matchType),
      prizePool: match.prizePool || this.getPrizePool(match.matchType),
      players: match.players || [],
      timestamp: new Date().toISOString(),
    };
  }

    static formatMatchInfo(data) {
    return {
      id: `cricket-${data.id}`,
      name: data.name,
      status: data.status,
      venue: data.venue,
      date: data.date,
      matchType: data.matchType,
      teams: data.teams,
      teamInfo: data.teamInfo,
      score: data.score?.map(s => ({ inning: s.inning, runs: s.r, wickets: s.w, overs: s.o })),
    };
  }

  // static formatSquadData(data) {
  //   return {
  //     matchId: data.matchId,
  //     teams: data.teams?.map(team => ({
  //       name: team.name,
  //       shortname: team.shortname,
  //       players: team.players?.map(p => ({
  //         id: p.id,
  //         name: p.name,
  //         role: p.role,
  //         battingStyle: p.battingStyle,
  //         bowlingStyle: p.bowlingStyle,
  //       })),
  //     })),
  //   };
  // }
   static formatSquadData(data) {
    return {
      matchId: data.matchId,
      teams: data.teams?.map(team => ({
        name: team.name,
        shortname: team.shortname,
        players: team.players?.map(p => ({
          id: p.id, name: p.name, role: p.role,
          battingStyle: p.battingStyle, bowlingStyle: p.bowlingStyle,
        })),
      })),
    };
  }

  static getEntryFee(matchType) {
    const fees = { 'test': 100, 'odi': 50, 't20': 25, 't20i': 25 };
    return fees[matchType?.toLowerCase()] || 25;
  }

  static getPrizePool(matchType) {
    const pools = { 'test': 500000, 'odi': 200000, 't20': 100000, 't20i': 100000 };
    return pools[matchType?.toLowerCase()] || 50000;
  }
}

export default CricketDataService;