import { Router } from 'express';
import BetController from '../Controllers/Bet_Controller.js';
import AuthMiddleware from '../Middlewares/Auth_Middleware.js';
import ValidationMiddleware from '../Middlewares/Validation_Middleware.js';
import betValidation from '../Validations/Bet_Validation.js';

const router = Router();

// All routes require authentication
router.use(AuthMiddleware.authenticate);

// Place bets
router.post(
  '/place',
  betValidation.placeBet,
  ValidationMiddleware.validate,
  BetController.placeBet
);

// Fantasy teams
router.post(
  '/create-team',
  betValidation.createTeam,
  ValidationMiddleware.validate,
  BetController.createFantasyTeam
);

router.put(
  '/teams/:teamId',
  betValidation.editTeam,
  ValidationMiddleware.validate,
  BetController.editFantasyTeam
);

// History
router.get('/my-bets', BetController.getMyBets);
router.get('/my-teams', BetController.getMyTeams);
router.get('/teams/:teamId', BetController.getTeamDetails);
router.get('/:betId', BetController.getBetDetails);

// Stats
router.get('/stats/summary', BetController.getBetStats);

export default router;