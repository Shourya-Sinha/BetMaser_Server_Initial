import { body } from 'express-validator';

const betValidation = {
  placeBet: [
    body('gameId')
      .notEmpty().withMessage('Game ID is required')
      .isMongoId().withMessage('Invalid game ID'),
    
    body('betType')
      .notEmpty().withMessage('Bet type is required')
      .isIn([
        'match_winner', 'toss_winner', 'top_batsman', 'top_bowler',
        'total_runs', 'total_wickets', 'total_sixes', 'total_fours',
        'man_of_match', 'first_innings_score', 'total_goals',
        'first_goal_scorer', 'correct_score'
      ]).withMessage('Invalid bet type'),
    
    body('betOption')
      .notEmpty().withMessage('Bet option is required'),
    
    body('amount')
      .notEmpty().withMessage('Amount is required')
      .isNumeric().withMessage('Amount must be a number')
      .custom(value => value >= 10).withMessage('Minimum bet is ₹10')
      .custom(value => value <= 10000).withMessage('Maximum bet is ₹10,000'),
    
    body('odds')
      .optional()
      .isNumeric().withMessage('Odds must be a number'),
  ],

  createTeam: [
    body('gameId')
      .notEmpty().withMessage('Game ID is required')
      .isMongoId().withMessage('Invalid game ID'),
    
    body('teamName')
      .trim()
      .notEmpty().withMessage('Team name is required')
      .isLength({ min: 3, max: 30 }).withMessage('Team name must be 3-30 characters'),
    
    body('players')
      .isArray({ min: 11, max: 11 }).withMessage('Team must have exactly 11 players'),
    
    body('players.*.id')
      .notEmpty().withMessage('Player ID is required'),
    
    body('players.*.name')
      .notEmpty().withMessage('Player name is required'),
    
    body('players.*.role')
      .notEmpty().withMessage('Player role is required'),
    
    body('captainId')
      .notEmpty().withMessage('Captain must be selected'),
    
    body('viceCaptainId')
      .notEmpty().withMessage('Vice-captain must be selected')
      .custom((value, { req }) => {
        if (value === req.body.captainId) {
          throw new Error('Captain and vice-captain must be different');
        }
        return true;
      }),
  ],

  editTeam: [
    body('players')
      .optional()
      .isArray({ min: 11, max: 11 }).withMessage('Team must have exactly 11 players'),
    
    body('captainId')
      .optional()
      .notEmpty().withMessage('Captain must be selected'),
    
    body('viceCaptainId')
      .optional()
      .notEmpty().withMessage('Vice-captain must be selected'),
  ],
};

export default betValidation;