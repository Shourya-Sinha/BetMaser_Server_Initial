import { Router } from 'express';
import NotificationController from '../Controllers/Notification_Controller.js';
import AuthMiddleware from '../Middlewares/Auth_Middleware.js';
import ValidationMiddleware from '../Middlewares/Validation_Middleware.js';

const router = Router();

// User routes (require authentication)
router.use(AuthMiddleware.authenticate);

// Get notifications
router.get('/', NotificationController.getNotifications);
router.get('/unread-count', NotificationController.getUnreadCount);

// Mark as read/clicked
router.put('/:id/read', NotificationController.markAsRead);
router.put('/:id/click', NotificationController.markAsClicked);
router.put('/read-all', NotificationController.markAllAsRead);

// Delete
router.delete('/:id', NotificationController.deleteNotification);
router.delete('/delete-all', NotificationController.deleteAllNotifications);

// Preferences
router.put('/preferences', NotificationController.updatePreferences);

// Admin routes (require admin role)
router.post('/send', 
  AuthMiddleware.authorize('admin', 'super_admin'),
  NotificationController.sendToUser
);

router.post('/send-bulk',
  AuthMiddleware.authorize('admin', 'super_admin'),
  NotificationController.sendBulk
);

router.post('/send-all',
  AuthMiddleware.authorize('admin', 'super_admin'),
  NotificationController.sendToAll
);

router.get('/stats',
  AuthMiddleware.authorize('admin', 'super_admin'),
  NotificationController.getStats
);

export default router;