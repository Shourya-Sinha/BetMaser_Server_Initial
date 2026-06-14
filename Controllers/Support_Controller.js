import { Support, User } from '../Models/index.js';
import ApiResponse from '../Utils/responseHandler.js';
import CLOG from '../Utils/Clog.js';
import { asyncHandler } from '../Utils/errorHandler.js';

class SupportController {

  // ============================================
  // USER TICKETS
  // ============================================

  /**
   * @desc    Create support ticket
   * @route   POST /api/v1/support/tickets
   * @access  Private
   */
  static createTicket = asyncHandler(async (req, res) => {
    const { subject, category, message, priority = 'medium', relatedGame, relatedTransaction } = req.body;

    const ticket = await Support.create({
      user: req.user._id,
      subject,
      category,
      priority,
      relatedGame,
      relatedTransaction,
      messages: [{
        sender: req.user._id,
        senderType: 'user',
        message,
        createdAt: new Date()
      }]
    });

    CLOG.info('Support ticket created:', ticket.ticketId);

    // Notify admins via socket
    if (global.socketManager) {
      global.socketManager.broadcast('support:new-ticket', {
        ticketId: ticket._id,
        ticketRef: ticket.ticketId,
        subject,
        category,
        priority
      });
    }

    res.status(201).json(
      ApiResponse.created({ 
        ticket: {
          id: ticket._id,
          ticketId: ticket.ticketId,
          subject: ticket.subject,
          status: ticket.status,
          createdAt: ticket.createdAt
        }
      }, 'Ticket created successfully')
    );
  });

  /**
   * @desc    Get user's tickets
   * @route   GET /api/v1/support/tickets
   * @access  Private
   */
  static getMyTickets = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status } = req.query;

    const filters = { user: req.user._id };
    if (status) filters.status = status;

    const tickets = await Support.find(filters)
      .select('ticketId subject category status priority createdAt updatedAt lastRepliedAt')
      .sort({ updatedAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    const total = await Support.countDocuments(filters);

    res.status(200).json(
      ApiResponse.success({
        tickets,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }, 'Tickets fetched successfully')
    );
  });

  /**
   * @desc    Get ticket details
   * @route   GET /api/v1/support/tickets/:id
   * @access  Private
   */
  static getTicketDetails = asyncHandler(async (req, res) => {
    const ticket = await Support.findById(req.params.id)
      .populate('user', 'fullName uid phone')
      .populate('messages.sender', 'fullName role')
      .populate('assignedTo', 'fullName')
      .lean();

    if (!ticket) {
      return res.status(404).json(
        ApiResponse.notFound('Ticket not found')
      );
    }

    // Check ownership or admin
    if (ticket.user._id.toString() !== req.user._id.toString() && 
        !['admin', 'super_admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json(
        ApiResponse.forbidden('Not authorized to view this ticket')
      );
    }

    res.status(200).json(
      ApiResponse.success(ticket, 'Ticket details fetched successfully')
    );
  });

  /**
   * @desc    Add reply to ticket
   * @route   POST /api/v1/support/tickets/:id/reply
   * @access  Private
   */
  static replyToTicket = asyncHandler(async (req, res) => {
    const { message, attachments } = req.body;

    const ticket = await Support.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json(
        ApiResponse.notFound('Ticket not found')
      );
    }

    // Check if ticket is closed
    if (ticket.status === 'closed') {
      return res.status(400).json(
        ApiResponse.badRequest('Cannot reply to a closed ticket')
      );
    }

    // Check ownership or admin
    const isAdmin = ['admin', 'super_admin', 'manager'].includes(req.user.role);
    if (ticket.user.toString() !== req.user._id.toString() && !isAdmin) {
      return res.status(403).json(
        ApiResponse.forbidden('Not authorized to reply to this ticket')
      );
    }

    const senderType = isAdmin ? 'admin' : 'user';
    await ticket.addMessage(req.user._id, senderType, message, attachments);

    // Notify via socket
    if (global.socketManager) {
      // Notify the other party
      const notifyUserId = isAdmin ? ticket.user : ticket.assignedTo;
      if (notifyUserId) {
        global.socketManager.sendToUser(notifyUserId.toString(), 'support:new-reply', {
          ticketId: ticket._id,
          ticketRef: ticket.ticketId
        });
      }
    }

    res.status(200).json(
      ApiResponse.success({ ticket }, 'Reply added successfully')
    );
  });

  /**
   * @desc    Close ticket (user)
   * @route   PUT /api/v1/support/tickets/:id/close
   * @access  Private
   */
  static closeTicket = asyncHandler(async (req, res) => {
    const ticket = await Support.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!ticket) {
      return res.status(404).json(
        ApiResponse.notFound('Ticket not found')
      );
    }

    if (ticket.status === 'closed') {
      return res.status(400).json(
        ApiResponse.badRequest('Ticket is already closed')
      );
    }

    await ticket.close(req.user._id);

    res.status(200).json(
      ApiResponse.success({ ticket }, 'Ticket closed successfully')
    );
  });

  /**
   * @desc    Add feedback/rating
   * @route   POST /api/v1/support/tickets/:id/feedback
   * @access  Private
   */
  static addFeedback = asyncHandler(async (req, res) => {
    const { rating, feedback } = req.body;

    const ticket = await Support.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!ticket) {
      return res.status(404).json(
        ApiResponse.notFound('Ticket not found')
      );
    }

    if (ticket.status !== 'resolved') {
      return res.status(400).json(
        ApiResponse.badRequest('Can only provide feedback for resolved tickets')
      );
    }

    await ticket.addFeedback(rating, feedback);

    res.status(200).json(
      ApiResponse.success(null, 'Feedback submitted successfully')
    );
  });

  // ============================================
  // ADMIN: TICKET MANAGEMENT
  // ============================================

  /**
   * @desc    Get all tickets (Admin)
   * @route   GET /api/v1/support/admin/tickets
   * @access  Private (Admin only)
   */
  static getAllTickets = asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      category, 
      priority,
      assignedTo,
      search 
    } = req.query;

    const filters = {};
    
    if (status) filters.status = status;
    if (category) filters.category = category;
    if (priority) filters.priority = priority;
    if (assignedTo) filters.assignedTo = assignedTo;
    if (search) {
      filters.$or = [
        { ticketId: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } }
      ];
    }

    const tickets = await Support.getAdminTickets(filters, parseInt(page), parseInt(limit));
    const total = await Support.countDocuments(filters);

    // Get stats
    const stats = await Support.getTicketStats();

    res.status(200).json(
      ApiResponse.success({
        tickets,
        stats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }, 'Tickets fetched successfully')
    );
  });

  /**
   * @desc    Assign ticket to admin
   * @route   PUT /api/v1/support/admin/tickets/:id/assign
   * @access  Private (Admin only)
   */
  static assignTicket = asyncHandler(async (req, res) => {
    const ticket = await Support.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json(
        ApiResponse.notFound('Ticket not found')
      );
    }

    await ticket.assign(req.user._id);

    CLOG.info('Ticket assigned:', ticket.ticketId, 'to', req.user._id);

    res.status(200).json(
      ApiResponse.success({ ticket }, 'Ticket assigned successfully')
    );
  });

  /**
   * @desc    Resolve ticket (Admin)
   * @route   PUT /api/v1/support/admin/tickets/:id/resolve
   * @access  Private (Admin only)
   */
  static resolveTicket = asyncHandler(async (req, res) => {
    const { solution } = req.body;
    const ticket = await Support.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json(
        ApiResponse.notFound('Ticket not found')
      );
    }

    await ticket.resolve(req.user._id, solution);

    // Notify user
    if (global.socketManager) {
      global.socketManager.sendToUser(ticket.user.toString(), 'support:ticket-resolved', {
        ticketId: ticket._id,
        ticketRef: ticket.ticketId
      });
    }

    CLOG.success('Ticket resolved:', ticket.ticketId);

    res.status(200).json(
      ApiResponse.success({ ticket }, 'Ticket resolved successfully')
    );
  });

  /**
   * @desc    Add internal note (Admin)
   * @route   POST /api/v1/support/admin/tickets/:id/note
   * @access  Private (Admin only)
   */
  static addInternalNote = asyncHandler(async (req, res) => {
    const { note } = req.body;
    const ticket = await Support.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json(
        ApiResponse.notFound('Ticket not found')
      );
    }

    await ticket.addInternalNote(req.user._id, note);

    res.status(200).json(
      ApiResponse.success(null, 'Internal note added')
    );
  });

  /**
   * @desc    Get support statistics (Admin)
   * @route   GET /api/v1/support/admin/stats
   * @access  Private (Admin only)
   */
  static getSupportStats = asyncHandler(async (req, res) => {
    const stats = await Support.getTicketStats();

    // Average resolution time
    const avgResolution = await Support.aggregate([
      { $match: { status: 'resolved', 'resolution.resolvedAt': { $exists: true } } },
      {
        $group: {
          _id: null,
          avgTime: { 
            $avg: { 
              $subtract: ['$resolution.resolvedAt', '$createdAt'] 
            } 
          }
        }
      }
    ]);

    // Tickets by category
    const byCategory = await Support.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    // User satisfaction
    const satisfaction = await Support.aggregate([
      { $match: { 'resolution.userSatisfaction': { $exists: true } } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$resolution.userSatisfaction' },
          totalRatings: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json(
      ApiResponse.success({
        statusStats: stats,
        avgResolutionTime: avgResolution[0]?.avgTime || 0,
        byCategory,
        satisfaction: satisfaction[0] || { avgRating: 0, totalRatings: 0 }
      }, 'Support stats fetched successfully')
    );
  });
}

export default SupportController;