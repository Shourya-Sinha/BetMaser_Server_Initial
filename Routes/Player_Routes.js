import { Router } from 'express';
import PlayerController from '../Controllers/Player_Controller.js';
import AuthMiddleware from '../Middlewares/Auth_Middleware.js';
import ValidationMiddleware from '../Middlewares/Validation_Middleware.js';

const router = Router();

// Public routes
router.get('/', PlayerController.getPlayers);
router.get('/search', PlayerController.searchPlayers);
router.get('/top', PlayerController.getTopPlayers);
router.get('/team/:teamName', PlayerController.getPlayersByTeam);
router.get('/role/:role', PlayerController.getPlayersByRole);
router.get('/:id', PlayerController.getPlayerById);
router.get('/:id/stats', PlayerController.getPlayerStats);

// Compare players
router.post('/compare', PlayerController.comparePlayers);

// Admin routes
router.use(AuthMiddleware.authenticate);
router.use(AuthMiddleware.authorize('admin', 'super_admin', 'manager'));

router.post('/', PlayerController.createPlayer);
router.post('/bulk-import', PlayerController.bulkImportPlayers);
router.put('/:id', PlayerController.updatePlayer);
router.put('/:id/match-stats', PlayerController.updateMatchStats);
router.delete('/:id', PlayerController.deletePlayer);

export default router;