import { Router } from 'express';
import TransactionController from '../Controllers/Transaction_Controller.js';
import AuthMiddleware from '../Middlewares/Auth_Middleware.js';

const router = Router();

// All routes require authentication
router.use(AuthMiddleware.authenticate);

// Transactions
router.get('/', TransactionController.getTransactions);
router.get('/stats', TransactionController.getTransactionStats);
router.get('/:id', TransactionController.getTransactionById);

// Withdrawals
router.get('/withdrawals', TransactionController.getWithdrawals);
router.get('/withdrawals/:id', TransactionController.getWithdrawalById);
router.post('/withdrawals/:id/cancel', TransactionController.cancelWithdrawal);

export default router;