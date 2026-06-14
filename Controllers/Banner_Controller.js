import {asyncHandler} from '../Utils/errorHandler.js';
import ApiResponse from '../Utils/responseHandler.js';

class BannerController {
  /**
   * @desc    Get banners for home screen
   * @route   GET /api/v1/banners/home
   * @access  Public
   */
  static getHomeBanners = asyncHandler(async (req, res) => {
    // For now, return static/mock banners
    // Later you can fetch from database
    const banners = [
      {
        id: 1,
        title: 'IPL 2025',
        subtitle: 'Create your dream team',
        image: 'https://via.placeholder.com/800x400/0D47A1/FFFFFF?text=IPL+2025',
        action: 'create_team',
        isActive: true,
        priority: 1,
      },
      {
        id: 2,
        title: 'Win Big',
        subtitle: 'Join contests & win real cash',
        image: 'https://via.placeholder.com/800x400/1B5E20/FFFFFF?text=Win+Big',
        action: 'join_contest',
        isActive: true,
        priority: 2,
      },
      {
        id: 3,
        title: 'Refer & Earn',
        subtitle: 'Get ₹50 per referral',
        image: 'https://via.placeholder.com/800x400/4A148C/FFFFFF?text=Refer+%26+Earn',
        action: 'refer',
        isActive: true,
        priority: 3,
      },
      {
        id: 4,
        title: 'Teen Patti',
        subtitle: 'Play live card games',
        image: 'https://via.placeholder.com/800x400/E65100/FFFFFF?text=Teen+Patti',
        action: 'play_teenpatti',
        isActive: true,
        priority: 4,
      },
    ];

    res.status(200).json({
      success: true,
      message: 'Banners fetched successfully',
      data: {
        banners,
        total: banners.length,
      },
    });
  });
}

export default BannerController;