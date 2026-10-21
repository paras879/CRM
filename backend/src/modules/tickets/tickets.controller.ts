import { Request, Response, NextFunction } from 'express';
import * as ticketService from './tickets.service.js';
import { CreateTicketInput, UpdateTicketInput, CreateTicketReplyInput, ListTicketsQuery, TicketCategoryInput } from './tickets.schema.js';
import { notifyTicketQueued } from '../notifications/support-notifications.js';
import { getSupportOverview as getSupportOverviewData } from './tickets-overview.service.js';

export async function listCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await ticketService.listTicketCategories(req.user!.companyId);
    res.json({ data: categories });
  } catch (error) {
    next(error);
  }
}

export async function createCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const category = await ticketService.createTicketCategory(req.user!.companyId, req.body as TicketCategoryInput);
    res.status(201).json({ data: category });
  } catch (error) {
    next(error);
  }
}

export async function listTickets(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await ticketService.listTickets(req.user!.companyId, req.query as unknown as ListTicketsQuery);
    res.json({
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function getTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const hasPerm = req.user?.permissions?.includes('tickets.view') ?? true;
    const canViewInternalNotes = hasPerm && req.query.includeInternal !== 'false';
    const ticket = await ticketService.getTicketById(req.user!.companyId, req.params.ticketId, canViewInternalNotes);
    res.json({ data: ticket });
  } catch (error) {
    next(error);
  }
}

export async function createTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const ticket = await ticketService.createTicket(req.user!.companyId, req.user!.id, req.body as CreateTicketInput);
    res.status(201).json({ data: ticket });
    void notifyTicketQueued(req.user!.companyId, req.user!.id, ticket);
  } catch (error) {
    next(error);
  }
}

export async function updateTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const ticket = await ticketService.updateTicket(
      req.user!.companyId,
      req.params.ticketId,
      req.user!.id,
      req.body as UpdateTicketInput
    );
    res.json({ data: ticket });
  } catch (error) {
    next(error);
  }
}

export async function archiveTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await ticketService.archiveTicket(req.user!.companyId, req.params.ticketId, req.user!.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function createReply(req: Request, res: Response, next: NextFunction) {
  try {
    const reply = await ticketService.createTicketReply(
      req.user!.companyId,
      req.params.ticketId,
      req.user!.id,
      req.body as CreateTicketReplyInput
    );
    res.status(201).json({ data: reply });
  } catch (error) {
    next(error);
  }
}

export async function deleteReply(req: Request, res: Response, next: NextFunction) {
  try {
    const isAdmin = req.user?.roles?.includes('Administrator') ?? false;
    const result = await ticketService.deleteTicketReply(
      req.user!.companyId,
      req.params.ticketId,
      req.params.replyId,
      req.user!.id,
      isAdmin
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getSupportOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const overview = await getSupportOverviewData(req.user!.companyId, req.user!.id);
    res.json({ data: overview });
  } catch (error) {
    next(error);
  }
}
