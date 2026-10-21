import { Request, Response, NextFunction } from 'express';
import * as leadsService from './leads.service.js';
import { notifyLeadAssigned } from '../notifications/work-notifications.js';

export async function listLeads(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await leadsService.listLeads(req.user!.companyId, req.query as any);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getLead(req: Request, res: Response, next: NextFunction) {
  try {
    const lead = await leadsService.getLeadById(req.user!.companyId, req.params.leadId);
    res.json({ lead });
  } catch (error) {
    next(error);
  }
}

export async function createLead(req: Request, res: Response, next: NextFunction) {
  try {
    const lead = await leadsService.createLead(req.user!.companyId, req.user!.id, req.body);
    res.status(201).json({ lead, message: 'Lead created successfully' });
    void notifyLeadAssigned(req.user!.companyId, req.user!.id, (lead as any).id, (lead as any).ownerId);
  } catch (error) {
    next(error);
  }
}

export async function updateLead(req: Request, res: Response, next: NextFunction) {
  try {
    const lead = await leadsService.updateLead(req.user!.companyId, req.user!.id, req.params.leadId, req.body);
    res.json({ lead, message: 'Lead updated successfully' });
  } catch (error) {
    next(error);
  }
}

export async function assignLead(req: Request, res: Response, next: NextFunction) {
  try {
    const lead = await leadsService.assignLead(req.user!.companyId, req.user!.id, req.params.leadId, req.body.ownerId);
    res.json({ lead, message: 'Lead assignment updated' });
    void notifyLeadAssigned(req.user!.companyId, req.user!.id, req.params.leadId, req.body.ownerId);
  } catch (error) {
    next(error);
  }
}

export async function archiveLead(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await leadsService.archiveLead(req.user!.companyId, req.user!.id, req.params.leadId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function restoreLead(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await leadsService.restoreLead(req.user!.companyId, req.user!.id, req.params.leadId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function deleteLead(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await leadsService.deleteLead(req.user!.companyId, req.user!.id, req.params.leadId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function convertLead(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await leadsService.convertLead(req.user!.companyId, req.user!.id, req.params.leadId, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function addLeadNote(req: Request, res: Response, next: NextFunction) {
  try {
    const note = await leadsService.addLeadNote(req.user!.companyId, req.user!.id, req.params.leadId, req.body.body);
    res.status(201).json({ note, message: 'Note added successfully' });
  } catch (error) {
    next(error);
  }
}

export async function listLeadSources(req: Request, res: Response, next: NextFunction) {
  try {
    const sources = await leadsService.listLeadSources(req.user!.companyId);
    res.json({ sources });
  } catch (error) {
    next(error);
  }
}

export async function createLeadSource(req: Request, res: Response, next: NextFunction) {
  try {
    const source = await leadsService.createLeadSource(req.user!.companyId, req.user!.id, req.body);
    res.status(201).json({ source, message: 'Lead source created' });
  } catch (error) {
    next(error);
  }
}

export async function listLeadStatuses(req: Request, res: Response, next: NextFunction) {
  try {
    const statuses = await leadsService.listLeadStatuses(req.user!.companyId);
    res.json({ statuses });
  } catch (error) {
    next(error);
  }
}

export async function createLeadStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const status = await leadsService.createLeadStatus(req.user!.companyId, req.user!.id, req.body);
    res.status(201).json({ status, message: 'Lead status created' });
  } catch (error) {
    next(error);
  }
}
