import { Router } from 'express';
import SupportController from '../Controllers/Support_Controller.js';
import AuthMiddleware from '../Middlewares/Auth_Middleware.js';
import ValidationMiddleware from '../Middlewares/Validation_Middleware.js';
import supportValidation from '../Validations/Support_Validation.js';

const router = Router();

// User routes (require authentication)
router.use(AuthMiddleware.authenticate);

// Ticket management
router.post('/tickets', 
  supportValidation.createTicket,
  ValidationMiddleware.validate,
  SupportController.createTicket
);

router.get('/tickets', SupportController.getMyTickets);
router.get('/tickets/:id', SupportController.getTicketDetails);

router.post('/tickets/:id/reply',
  supportValidation.replyTicket,
  ValidationMiddleware.validate,
  SupportController.replyToTicket
);

router.put('/tickets/:id/close', SupportController.closeTicket);
router.post('/tickets/:id/feedback', 
  supportValidation.addFeedback,
  ValidationMiddleware.validate,
  SupportController.addFeedback
);

// Admin routes
router.get('/admin/tickets',
  AuthMiddleware.authorize('admin', 'super_admin', 'manager'),
  SupportController.getAllTickets
);

router.put('/admin/tickets/:id/assign',
  AuthMiddleware.authorize('admin', 'super_admin'),
  SupportController.assignTicket
);

router.put('/admin/tickets/:id/resolve',
  AuthMiddleware.authorize('admin', 'super_admin', 'manager'),
  supportValidation.resolveTicket,
  ValidationMiddleware.validate,
  SupportController.resolveTicket
);

router.post('/admin/tickets/:id/note',
  AuthMiddleware.authorize('admin', 'super_admin', 'manager'),
  supportValidation.addNote,
  ValidationMiddleware.validate,
  SupportController.addInternalNote
);

router.get('/admin/stats',
  AuthMiddleware.authorize('admin', 'super_admin'),
  SupportController.getSupportStats
);

export default router;