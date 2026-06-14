import { Router } from 'express';
import GameController from '../Controllers/Game_Controller.js';
import AuthMiddleware from '../Middlewares/Auth_Middleware.js';
import ValidationMiddleware from '../Middlewares/Validation_Middleware.js';

const router = Router();

// Public routes
router.get('/', GameController.getGames);
router.get('/live', GameController.getLiveGames);
router.get('/upcoming', GameController.getUpcomingGames);
router.get('/featured', GameController.getFeaturedGames);
router.get('/categories', GameController.getCategories);

// Game details (public)
router.get('/:id', GameController.getGameById);
router.get('/:id/score', GameController.getMatchScore);  // ✅ NEW: Live score from API
router.get('/:id/odds', GameController.getGameOdds);
router.get('/:id/players', GameController.getGamePlayers);
router.get('/:id/squad', GameController.getMatchSquad);  
router.get('/:id/leaderboard', GameController.getGameLeaderboard);

// Contests (public)
router.get('/:id/contests', GameController.getGameContests);
router.get('/:gameId/contests/:contestId', GameController.getContestDetails);

// Protected routes (require authentication)
router.use(AuthMiddleware.authenticate);

// Join contest
router.post('/:gameId/contests/:contestId/join', GameController.joinContest);

export default router;