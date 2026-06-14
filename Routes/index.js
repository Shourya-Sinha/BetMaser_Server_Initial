import { Router } from "express";

const router = Router();

import Auth_Routes from './Auth_Routes.js';
import Health_Routes from './Health_Routes.js';

import userRoutes from '../Routes/User_Routes.js';
import walletRoutes from '../Routes/Wallet_Routes.js';
import gameRoutes from '../Routes/Game_Routes.js';
import betRoutes from '../Routes/Bet_Routes.js';
import adminRoutes from '../Routes/Admin_Routes.js';
import transactionRoutes from '../Routes/Transaction_Routes.js';

import notificationRoutes from '../Routes/Notification_Routes.js';
import supportRoutes from '../Routes/Support_Routes.js';
import paymentRoutes from '../Routes/Payment_Routes.js';

import playerRoutes from '../Routes/Player_Routes.js';
import liveGameRoutes from '../Routes/LiveGame_Routes.js';
import bannerRoutes from '../Routes/Banner_Route.js';

// import withdrawalRoutes from './routes/withdrawal.routes.js';
// import bannerRoutes from './routes/banner.routes.js';

router.use('/auth',Auth_Routes);
router.use('/health',Health_Routes);

router.use('/users', userRoutes);
router.use('/wallet', walletRoutes);

router.use('/games', gameRoutes);
router.use('/bets', betRoutes);

router.use('/admin', adminRoutes);
router.use('/transactions', transactionRoutes);

router.use('/notifications', notificationRoutes);
router.use('/support', supportRoutes);
router.use('/payments', paymentRoutes);

router.use('/players', playerRoutes);
router.use('/live-games', liveGameRoutes);

router.use('/banners', bannerRoutes);


router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'BetMaster API is running',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

export default router;