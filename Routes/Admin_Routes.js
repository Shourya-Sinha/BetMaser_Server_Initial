import { Router } from 'express';
import AdminController from '../Controllers/Admin_Controller.js';
import AuthMiddleware from '../Middlewares/Auth_Middleware.js';
import ValidationMiddleware from '../Middlewares/Validation_Middleware.js';
import adminValidation from '../Validations/Admin_Validation.js';

const router = Router();

// All admin routes require authentication + admin role
router.use(AuthMiddleware.authenticate);
router.use(AuthMiddleware.authorize('admin', 'super_admin', 'manager'));

// Dashboard
router.get('/dashboard', AdminController.getDashboard);
router.get('/analytics', AdminController.getAnalytics);

// User management
router.get('/users', AdminController.getUsers);
router.get('/users/:userId', AdminController.getUserDetails);
router.put('/users/:userId/toggle-block', adminValidation.toggleBlock, ValidationMiddleware.validate, AdminController.toggleUserBlock);
router.put('/users/:userId/verify', AdminController.verifyUser);

// Super admin only
router.put('/users/:userId/role', 
  AuthMiddleware.authorize('super_admin'),
  adminValidation.updateRole,
  ValidationMiddleware.validate,
  AdminController.updateUserRole
);

// KYC management
router.get('/kyc/pending', AdminController.getPendingKYC);
router.put('/kyc/:kycId/approve', AdminController.approveKYC);
router.put('/kyc/:kycId/reject', adminValidation.rejectKYC, ValidationMiddleware.validate, AdminController.rejectKYC);

// Withdrawal management
router.get('/withdrawals/pending', AdminController.getPendingWithdrawals);
router.put('/withdrawals/:withdrawalId/process', adminValidation.processWithdrawal, ValidationMiddleware.validate, AdminController.processWithdrawal);

// Game management
router.post('/games', adminValidation.createGame, ValidationMiddleware.validate, AdminController.createGame);
router.put('/games/:gameId', adminValidation.updateGame, ValidationMiddleware.validate, AdminController.updateGame);
router.post('/games/:gameId/declare-result', adminValidation.declareResult, ValidationMiddleware.validate, AdminController.declareGameResult);

// Settings
router.get('/settings', AdminController.getSettings);
router.put('/settings/:key', AdminController.updateSetting);
router.put('/settings/bulk', AdminController.bulkUpdateSettings);

// Banners
router.get('/banners', AdminController.getBanners);
router.post('/banners', adminValidation.createBanner, ValidationMiddleware.validate, AdminController.createBanner);
router.put('/banners/:bannerId', AdminController.updateBanner);

export default router;