import { Request, Response, NextFunction } from 'express';
import * as service from './contracts.service.js';

export async function listContracts(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listContracts(req.user!.companyId, req.query as any);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getContract(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getContractById(req.user!.companyId, req.params.contractId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function createContract(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.createContract(req.user!.companyId, req.user!.id, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function updateContract(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.updateContract(req.user!.companyId, req.params.contractId, req.user!.id, req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function archiveContract(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.archiveContract(req.user!.companyId, req.params.contractId, req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
