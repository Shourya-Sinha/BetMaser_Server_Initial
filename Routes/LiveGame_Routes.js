import { Router } from 'express';
import LiveGameController from '../Controllers/LiveGame_Controller.js';
import AuthMiddleware from '../Middlewares/Auth_Middleware.js';

const router = Router();

// Public routes
router.get('/rooms', LiveGameController.getAvailableRooms);
router.get('/rooms/:roomCode', LiveGameController.getRoomDetails);

// Protected routes
router.use(AuthMiddleware.authenticate);

// Room management
router.post('/create', LiveGameController.createRoom);
router.post('/join', LiveGameController.joinRoom);
router.post('/leave', LiveGameController.leaveRoom);

// Game actions
router.post('/:id/start', LiveGameController.startRound);
router.post('/:id/action', LiveGameController.performAction);
router.get('/:id/state', LiveGameController.getGameState);

// Chat
router.post('/:id/chat', LiveGameController.sendChat);
router.get('/:id/chat', LiveGameController.getChatHistory);

export default router;