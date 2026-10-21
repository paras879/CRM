import { Request, Response, NextFunction } from 'express';
import * as customersService from './customers.service.js';

export async function listCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await customersService.listCustomers(
      req.user!.companyId,
      req.query as any
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const customer = await customersService.getCustomerById(
      req.user!.companyId,
      req.params.customerId
    );
    res.json({ customer });
  } catch (error) {
    next(error);
  }
}

export async function createCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const customer = await customersService.createCustomer(
      req.user!.companyId,
      req.user!.id,
      req.body
    );
    res.status(201).json({ customer, message: 'Customer created successfully' });
  } catch (error) {
    next(error);
  }
}

export async function updateCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const customer = await customersService.updateCustomer(
      req.user!.companyId,
      req.user!.id,
      req.params.customerId,
      req.body
    );
    res.json({ customer, message: 'Customer updated successfully' });
  } catch (error) {
    next(error);
  }
}

export async function archiveCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await customersService.archiveCustomer(
      req.user!.companyId,
      req.user!.id,
      req.params.customerId
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function restoreCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await customersService.restoreCustomer(
      req.user!.companyId,
      req.user!.id,
      req.params.customerId
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function deleteCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await customersService.deleteCustomer(
      req.user!.companyId,
      req.user!.id,
      req.params.customerId
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function addContact(req: Request, res: Response, next: NextFunction) {
  try {
    const contact = await customersService.addContact(
      req.user!.companyId,
      req.user!.id,
      req.params.customerId,
      req.body
    );
    res.status(201).json({ contact, message: 'Contact added successfully' });
  } catch (error) {
    next(error);
  }
}

export async function updateContact(req: Request, res: Response, next: NextFunction) {
  try {
    const contact = await customersService.updateContact(
      req.user!.companyId,
      req.user!.id,
      req.params.customerId,
      req.params.contactId,
      req.body
    );
    res.json({ contact, message: 'Contact updated successfully' });
  } catch (error) {
    next(error);
  }
}

export async function deleteContact(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await customersService.deleteContact(
      req.user!.companyId,
      req.user!.id,
      req.params.customerId,
      req.params.contactId
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function addCustomerNote(req: Request, res: Response, next: NextFunction) {
  try {
    const note = await customersService.addCustomerNote(
      req.user!.companyId,
      req.user!.id,
      req.params.customerId,
      req.body.body
    );
    res.status(201).json({ note, message: 'Note added successfully' });
  } catch (error) {
    next(error);
  }
}
