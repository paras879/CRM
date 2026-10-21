import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validate } from '../../middleware/validate.js';
import {
  CreateTicketSchema,
  UpdateTicketSchema,
  CreateTicketReplySchema,
  ListTicketsQuerySchema,
  TicketCategorySchema,
} from './tickets.schema.js';
import * as controller from './tickets.controller.js';

export const ticketsRouter = Router();

ticketsRouter.use(requireAuth);

// Categories
ticketsRouter.get(
  '/categories',
  requirePermission('tickets.view'),
  controller.listCategories
);

ticketsRouter.post(
  '/categories',
  requirePermission('tickets.create'),
  validate({ body: TicketCategorySchema }),
  controller.createCategory
);

// Tickets CRUD
ticketsRouter.get(
  '/',
  requirePermission('tickets.view'),
  validate({ query: ListTicketsQuerySchema }),
  controller.listTickets
);

ticketsRouter.get(
  '/overview',
  requirePermission('tickets.view'),
  controller.getSupportOverview
);

ticketsRouter.get(
  '/:ticketId',
  requirePermission('tickets.view'),
  controller.getTicket
);

ticketsRouter.post(
  '/',
  requirePermission('tickets.create'),
  validate({ body: CreateTicketSchema }),
  controller.createTicket
);

ticketsRouter.put(
  '/:ticketId',
  requirePermission('tickets.update'),
  validate({ body: UpdateTicketSchema }),
  controller.updateTicket
);

ticketsRouter.patch(
  '/:ticketId',
  requirePermission('tickets.update'),
  validate({ body: UpdateTicketSchema }),
  controller.updateTicket
);

ticketsRouter.delete(
  '/:ticketId',
  requirePermission('tickets.delete'),
  controller.archiveTicket
);

// Replies & Notes
ticketsRouter.post(
  '/:ticketId/replies',
  requirePermission('tickets.reply'),
  validate({ body: CreateTicketReplySchema }),
  controller.createReply
);

ticketsRouter.delete(
  '/:ticketId/replies/:replyId',
  requirePermission('tickets.reply'),
  controller.deleteReply
);
