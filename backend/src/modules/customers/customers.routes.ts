import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validate } from '../../middleware/validate.js';
import {
  CreateCustomerSchema,
  UpdateCustomerSchema,
  ListCustomersQuerySchema,
  CreateContactSchema,
  UpdateContactSchema,
  AddNoteSchema,
} from './customers.schema.js';
import * as controller from './customers.controller.js';

export const customersRouter = Router();

// All customer routes require authentication
customersRouter.use(requireAuth);

// Customer CRUD
customersRouter.get(
  '/',
  requirePermission('customers.view'),
  validate({ query: ListCustomersQuerySchema }),
  controller.listCustomers
);

customersRouter.get(
  '/:customerId',
  requirePermission('customers.view'),
  controller.getCustomer
);

customersRouter.post(
  '/',
  requirePermission('customers.create'),
  validate({ body: CreateCustomerSchema }),
  controller.createCustomer
);

customersRouter.put(
  '/:customerId',
  requirePermission('customers.update'),
  validate({ body: UpdateCustomerSchema }),
  controller.updateCustomer
);

customersRouter.patch(
  '/:customerId/archive',
  requirePermission('customers.update'),
  controller.archiveCustomer
);

customersRouter.patch(
  '/:customerId/restore',
  requirePermission('customers.update'),
  controller.restoreCustomer
);

customersRouter.delete(
  '/:customerId',
  requirePermission('customers.delete'),
  controller.deleteCustomer
);

// Customer Contacts
customersRouter.post(
  '/:customerId/contacts',
  requirePermission('customers.update'),
  validate({ body: CreateContactSchema }),
  controller.addContact
);

customersRouter.put(
  '/:customerId/contacts/:contactId',
  requirePermission('customers.update'),
  validate({ body: UpdateContactSchema }),
  controller.updateContact
);

customersRouter.delete(
  '/:customerId/contacts/:contactId',
  requirePermission('customers.update'),
  controller.deleteContact
);

// Customer Notes
customersRouter.post(
  '/:customerId/notes',
  requirePermission('customers.update'),
  validate({ body: AddNoteSchema }),
  controller.addCustomerNote
);
