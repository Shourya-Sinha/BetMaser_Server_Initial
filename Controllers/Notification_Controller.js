import { Notification, User } from '../Models/index.js';
import ApiResponse from '../Utils/responseHandler.js';
import CLOG from '../Utils/Clog.js';
import { asyncHandler } from '../Utils/errorHandler.js';

class NotificationController {

  // ============================================
  // USER NOTIFICATIONS
  // ============================================

  /**
   * @desc    Get all notifications for logged-in user
   * @route   GET /api/v1/notifications
   * @access  Private
   */
  static getNotifications = asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 20, 
      type, 
      isRead,
      priority 
    } = req.query;

    const filters = { user: req.user._id };
    
    if (type) filters.type = type;
    if (isRead !== undefined) filters.isRead = isRead === 'true';
    if (priority) filters.priority = priority;

    const notifications = await Notification.find(filters)
      .populate('game', 'name type')
      .populate('bet', 'amount betType')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    const total = await Notification.countDocuments(filters);
    const unreadCount = await Notification.getUnreadCount(req.user._id);

    res.status(200).json(
      ApiResponse.success({
        notifications,
        unreadCount,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }, 'Notifications fetched successfully')
    );
  });

  /**
   * @desc    Get unread notification count
   * @route   GET /api/v1/notifications/unread-count
   * @access  Private
   */
  static getUnreadCount = asyncHandler(async (req, res) => {
    const count = await Notification.getUnreadCount(req.user._id);

    res.status(200).json(
      ApiResponse.success({ unreadCount: count }, 'Unread count fetched')
    );
  });

  /**
   * @desc    Mark notification as read
   * @route   PUT /api/v1/notifications/:id/read
   * @access  Private
   */
  static markAsRead = asyncHandler(async (req, res) => {
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!notification) {
      return res.status(404).json(
        ApiResponse.notFound('Notification not found')
      );
    }

    await notification.markAsRead();

    res.status(200).json(
      ApiResponse.success(null, 'Notification marked as read')
    );
  });

  /**
   * @desc    Mark notification as clicked
   * @route   PUT /api/v1/notifications/:id/click
   * @access  Private
   */
  static markAsClicked = asyncHandler(async (req, res) => {
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!notification) {
      return res.status(404).json(
        ApiResponse.notFound('Notification not found')
      );
    }

    await notification.markAsClicked();

    res.status(200).json(
      ApiResponse.success(null, 'Notification marked as clicked')
    );
  });

  /**
   * @desc    Mark all notifications as read
   * @route   PUT /api/v1/notifications/read-all
   * @access  Private
   */
  static markAllAsRead = asyncHandler(async (req, res) => {
    await Notification.markAllAsRead(req.user._id);

    res.status(200).json(
      ApiResponse.success(null, 'All notifications marked as read')
    );
  });

  /**
   * @desc    Delete notification
   * @route   DELETE /api/v1/notifications/:id
   * @access  Private
   */
  static deleteNotification = asyncHandler(async (req, res) => {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!notification) {
      return res.status(404).json(
        ApiResponse.notFound('Notification not found')
      );
    }

    res.status(200).json(
      ApiResponse.success(null, 'Notification deleted')
    );
  });

  /**
   * @desc    Delete all notifications
   * @route   DELETE /api/v1/notifications/delete-all
   * @access  Private
   */
  static deleteAllNotifications = asyncHandler(async (req, res) => {
    await Notification.deleteMany({ user: req.user._id });

    res.status(200).json(
      ApiResponse.success(null, 'All notifications deleted')
    );
  });

  /**
   * @desc    Update notification preferences
   * @route   PUT /api/v1/notifications/preferences
   * @access  Private
   */
  static updatePreferences = asyncHandler(async (req, res) => {
    const { push, email, sms, gameReminders, promotionalOffers, sound, vibration } = req.body;
    
    const user = req.user;
    const prefs = user.preferences.notifications;

    if (push !== undefined) prefs.push = push;
    if (email !== undefined) prefs.email = email;
    if (sms !== undefined) prefs.sms = sms;
    if (gameReminders !== undefined) prefs.gameReminders = gameReminders;
    if (promotionalOffers !== undefined) prefs.promotionalOffers = promotionalOffers;
    if (sound !== undefined) prefs.sound = sound;
    if (vibration !== undefined) prefs.vibration = vibration;

    await user.save();

    res.status(200).json(
      ApiResponse.success({ preferences: prefs }, 'Notification preferences updated')
    );
  });

  // ============================================
  // ADMIN: SEND NOTIFICATIONS
  // ============================================

  /**
   * @desc    Send notification to single user (Admin)
   * @route   POST /api/v1/notifications/send
   * @access  Private (Admin only)
   */
  static sendToUser = asyncHandler(async (req, res) => {
    const { userId, title, message, type = 'system', priority = 'medium', image, deepLink } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json(
        ApiResponse.notFound('User not found')
      );
    }

    const notification = await Notification.create({
      user: userId,
      type,
      title,
      message,
      image,
      deepLink,
      priority,
      channels: ['push', 'in_app']
    });

    // Send real-time notification via socket
    if (global.socketManager) {
      global.socketManager.sendToUser(userId.toString(), 'notification:new', {
        id: notification._id,
        title,
        message,
        type,
        priority,
        image,
        deepLink,
        timestamp: new Date()
      });
    }

    CLOG.info('Notification sent to user:', userId);

    res.status(201).json(
      ApiResponse.created({ notification }, 'Notification sent successfully')
    );
  });

  /**
   * @desc    Send notification to multiple users (Admin)
   * @route   POST /api/v1/notifications/send-bulk
   * @access  Private (Admin only)
   */
  static sendBulk = asyncHandler(async (req, res) => {
    const { userIds, title, message, type = 'system', priority = 'medium', image, deepLink } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json(
        ApiResponse.badRequest('User IDs array is required')
      );
    }

    const notifications = [];
    for (const userId of userIds) {
      const notification = await Notification.create({
        user: userId,
        type,
        title,
        message,
        image,
        deepLink,
        priority,
        channels: ['push', 'in_app']
      });
      notifications.push(notification);

      // Send real-time notification
      if (global.socketManager) {
        global.socketManager.sendToUser(userId.toString(), 'notification:new', {
          id: notification._id,
          title,
          message,
          type,
          priority,
          timestamp: new Date()
        });
      }
    }

    CLOG.info(`Bulk notification sent to ${userIds.length} users`);

    res.status(201).json(
      ApiResponse.created({ 
        sentCount: notifications.length,
        totalUsers: userIds.length 
      }, 'Bulk notifications sent successfully')
    );
  });

  /**
   * @desc    Send notification to all users (Admin)
   * @route   POST /api/v1/notifications/send-all
   * @access  Private (Admin only)
   */
  static sendToAll = asyncHandler(async (req, res) => {
    const { title, message, type = 'system', priority = 'medium', image, deepLink, role } = req.body;

    // Get all active users
    const userFilter = { isActive: true };
    if (role) userFilter.role = role;

    const users = await User.find(userFilter).select('_id');
    const userIds = users.map(u => u._id);

    // Create notifications in batches
    const batchSize = 100;
    let sentCount = 0;

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      const notificationBatch = batch.map(userId => ({
        user: userId,
        type,
        title,
        message,
        image,
        deepLink,
        priority,
        channels: ['push', 'in_app']
      }));

      await Notification.insertMany(notificationBatch);
      sentCount += batch.length;

      // Send real-time to online users
      if (global.socketManager) {
        batch.forEach(userId => {
          global.socketManager.sendToUser(userId.toString(), 'notification:new', {
            title,
            message,
            type,
            priority,
            timestamp: new Date()
          });
        });
      }
    }

    CLOG.info(`Notification sent to all users (${sentCount} recipients)`);

    res.status(201).json(
      ApiResponse.created({ 
        sentCount,
        totalUsers: userIds.length 
      }, 'Notification sent to all users')
    );
  });

  /**
   * @desc    Get notification statistics (Admin)
   * @route   GET /api/v1/notifications/stats
   * @access  Private (Admin only)
   */
  static getStats = asyncHandler(async (req, res) => {
    const stats = await Notification.aggregate([
      {
        $group: {
          _id: '$type',
          total: { $sum: 1 },
          read: { $sum: { $cond: ['$isRead', 1, 0] } },
          clicked: { $sum: { $cond: ['$isClicked', 1, 0] } },
          unread: { $sum: { $cond: ['$isRead', 0, 1] } }
        }
      },
      { $sort: { total: -1 } }
    ]);

    const totalSent = await Notification.countDocuments();
    const totalRead = await Notification.countDocuments({ isRead: true });
    const readRate = totalSent > 0 ? ((totalRead / totalSent) * 100).toFixed(2) : 0;

    res.status(200).json(
      ApiResponse.success({
        stats,
        summary: {
          totalSent,
          totalRead,
          readRate: `${readRate}%`
        }
      }, 'Notification stats fetched successfully')
    );
  });
}

export default NotificationController;