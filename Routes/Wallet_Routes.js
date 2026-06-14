import { Router } from 'express';

import WalletController from '../Controllers/Wallet_Controller.js';
import AuthMiddleware from '../Middlewares/Auth_Middleware.js';
import ValidationMiddleware from '../Middlewares/Validation_Middleware.js';
import walletValidation from '../Validations/Wallet_Validation.js';

const router = Router();

// All routes require authentication
router.use(AuthMiddleware.authenticate);

// Balance
router.get('/balance', WalletController.getBalance);

// Deposit
router.post(
  '/deposit',
  walletValidation.initiateDeposit,
  ValidationMiddleware.validate,
  WalletController.initiateDeposit
);

router.post(
  '/deposit/confirm',
  walletValidation.confirmDeposit,
  ValidationMiddleware.validate,
  WalletController.confirmDeposit
);

// Withdrawal
router.post(
  '/withdraw',
  walletValidation.initiateWithdrawal,
  ValidationMiddleware.validate,
  WalletController.initiateWithdrawal
);

// History
router.get('/transactions', WalletController.getTransactionHistory);
router.get('/withdrawals', WalletController.getWithdrawalHistory);
router.get('/summary', WalletController.getWalletSummary);

export default router;