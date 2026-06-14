import { Router } from 'express';
import UserController from '../Controllers/User_Controller.js';
import AuthMiddleware from '../Middlewares/Auth_Middleware.js';
import ValidationMiddleware from '../Middlewares/Validation_Middleware.js';
import userValidation from '../Validations/User_Validation.js';

const router = Router();

// All routes require authentication
router.use(AuthMiddleware.authenticate);

// Profile routes
router.get('/get-profile', UserController.getProfile);
router.put('/update-profile', userValidation.updateProfile, ValidationMiddleware.validate, UserController.updateProfile);
router.put('/profile-picture', UserController.updateProfilePicture);
router.put('/change-username', userValidation.changeUsername, ValidationMiddleware.validate, UserController.changeUsername);

// Wallet routes
router.get('/wallet', UserController.getWallet);
router.get('/transactions', UserController.getTransactions);

// Game & Bet history
router.get('/game-stats', UserController.getGameStats);
router.get('/bet-history', UserController.getBetHistory);
router.get('/game-history', UserController.getGameHistory);

// KYC routes
router.get('/kyc', UserController.getKYC);
router.post('/kyc', userValidation.submitKYC, ValidationMiddleware.validate, UserController.submitKYC);

// Referral routes
router.get('/referral', UserController.getReferral);

// Notification routes
router.get('/notifications', UserController.getNotifications);
router.put('/notifications/:id/read', UserController.markNotificationRead);
router.put('/notifications/read-all', UserController.markAllNotificationsRead);

// Security routes
router.get('/security', UserController.getSecurityInfo);
router.post('/deactivate', userValidation.deactivateAccount, ValidationMiddleware.validate, UserController.deactivateAccount);
router.post('/logout-all', UserController.logoutAll);

export default router;