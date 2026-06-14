import { Router } from 'express';
import BannerController from '../Controllers/Banner_Controller.js';

const router = Router();

// Public routes
router.get('/home', BannerController.getHomeBanners);

export default router;