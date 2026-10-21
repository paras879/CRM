import { PrismaClient, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PERMISSIONS = [
  // Auth & Dashboard
  { key: 'dashboard.view', description: 'View dashboard metrics', module: 'dashboard' },
  // Company & Settings
  { key: 'company.view', description: 'View company settings', module: 'company' },
  { key: 'company.update', description: 'Update company settings', module: 'company' },
  { key: 'settings.view', description: 'View general settings', module: 'settings' },
  { key: 'settings.update', description: 'Update general settings', module: 'settings' },
  // Users & Roles
  { key: 'users.view', description: 'View staff users', module: 'users' },
  { key: 'users.create', description: 'Create staff users', module: 'users' },
  { key: 'users.update', description: 'Update staff users', module: 'users' },
  { key: 'users.delete', description: 'Deactivate or delete users', module: 'users' },
  { key: 'roles.view', description: 'View roles', module: 'roles' },
  { key: 'roles.manage', description: 'Create and update roles', module: 'roles' },
  { key: 'permissions.view', description: 'View permissions list', module: 'permissions' },
  // Audit
  { key: 'audit.view', description: 'View system audit logs', module: 'audit' },
  // Leads & Customers
  { key: 'leads.view', description: 'View leads', module: 'leads' },
  { key: 'leads.create', description: 'Create leads', module: 'leads' },
  { key: 'leads.update', description: 'Update leads', module: 'leads' },
  { key: 'leads.delete', description: 'Delete leads', module: 'leads' },
  { key: 'leads.convert', description: 'Convert leads to customers', module: 'leads' },
  { key: 'customers.view', description: 'View customers', module: 'customers' },
  { key: 'customers.create', description: 'Create customers', module: 'customers' },
  { key: 'customers.update', description: 'Update customers', module: 'customers' },
  { key: 'customers.delete', description: 'Delete customers', module: 'customers' },
  // Projects & Tasks
  { key: 'projects.view', description: 'View projects', module: 'projects' },
  { key: 'projects.create', description: 'Create projects', module: 'projects' },
  { key: 'projects.update', description: 'Update projects', module: 'projects' },
  { key: 'projects.delete', description: 'Delete projects', module: 'projects' },
  { key: 'tasks.view', description: 'View tasks', module: 'tasks' },
  { key: 'tasks.create', description: 'Create tasks', module: 'tasks' },
  { key: 'tasks.update', description: 'Update tasks', module: 'tasks' },
  { key: 'tasks.delete', description: 'Delete tasks', module: 'tasks' },
  // Sales & Finance
  { key: 'proposals.view', description: 'View proposals', module: 'sales' },
  { key: 'proposals.create', description: 'Create proposals', module: 'sales' },
  { key: 'proposals.update', description: 'Update proposals', module: 'sales' },
  { key: 'proposals.delete', description: 'Delete proposals', module: 'sales' },
  { key: 'estimates.view', description: 'View estimates', module: 'sales' },
  { key: 'estimates.create', description: 'Create estimates', module: 'sales' },
  { key: 'estimates.update', description: 'Update estimates', module: 'sales' },
  { key: 'estimates.delete', description: 'Delete estimates', module: 'sales' },
  { key: 'contracts.view', description: 'View contracts', module: 'sales' },
  { key: 'contracts.create', description: 'Create contracts', module: 'sales' },
  { key: 'contracts.update', description: 'Update contracts', module: 'sales' },
  { key: 'contracts.delete', description: 'Delete contracts', module: 'sales' },
  { key: 'invoices.view', description: 'View invoices', module: 'finance' },
  { key: 'invoices.create', description: 'Create invoices', module: 'finance' },
  { key: 'invoices.update', description: 'Update draft invoices', module: 'finance' },
  { key: 'invoices.issue', description: 'Issue finalized invoices', module: 'finance' },
  { key: 'invoices.void', description: 'Void issued invoices', module: 'finance' },
  { key: 'payments.view', description: 'View recorded payments', module: 'finance' },
  { key: 'payments.record', description: 'Record invoice payments', module: 'finance' },
  { key: 'expenses.view', description: 'View recorded expenses', module: 'finance' },
  { key: 'expenses.create', description: 'Create expenses', module: 'finance' },
  { key: 'expenses.update', description: 'Update expenses', module: 'finance' },
  { key: 'expenses.approve', description: 'Approve or reject expenses', module: 'finance' },
  // Support & Reports
  { key: 'tickets.view', description: 'View support tickets', module: 'support' },
  { key: 'tickets.create', description: 'Create support tickets', module: 'support' },
  { key: 'tickets.update', description: 'Update support tickets', module: 'support' },
  { key: 'tickets.reply', description: 'Reply to support tickets', module: 'support' },
  { key: 'reports.view', description: 'View business reports', module: 'reports' },
  { key: 'reports.export', description: 'Export report data', module: 'reports' },
  { key: 'attachments.view', description: 'View and download attachments', module: 'attachments' },
  { key: 'attachments.upload', description: 'Upload attachments', module: 'attachments' },
  { key: 'attachments.delete', description: 'Delete attachments', module: 'attachments' },
];

async function main() {
  // The two administrator accounts are a Super Admin and an Admin; both hold the Administrator role, which
  // carries every permission. They are checked first so a mistake stops the run before anything is written.
  // Real deployments must supply the credentials; the development fallbacks below only let a local
  // database be seeded without any setup.
  const isProduction = process.env.NODE_ENV === 'production';
  const required = (name: string, fallback: string) => {
    const value = process.env[name];
    if (value) return value;
    if (isProduction) {
      throw new Error(`${name} must be set to seed a production database.`);
    }
    return fallback;
  };

  const accounts = [
    {
      label: 'Super Admin',
      email: required('INITIAL_SUPER_ADMIN_EMAIL', 'superadmin@businesscrm.local').toLowerCase(),
      password: required('INITIAL_SUPER_ADMIN_PASSWORD', 'Admin@Secure123!'),
    },
    {
      label: 'Admin',
      email: required('INITIAL_ADMIN_EMAIL', 'admin@businesscrm.local').toLowerCase(),
      password: required('INITIAL_ADMIN_PASSWORD', 'Admin@Secure123!'),
    },
  ];

  // The first sign-in on a live system is an administrator, so refuse passwords that are easy to guess.
  // These are the same rules as creating a user in the app.
  const isStrong = (password: string) =>
    password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);
  const looksLikeEmail = (value: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
  for (const account of accounts) {
    if (isProduction && !looksLikeEmail(account.email)) {
      throw new Error(`${account.label}: "${account.email}" is not a valid email address.`);
    }
    if (isProduction && !isStrong(account.password)) {
      throw new Error(
        `${account.label}: the password needs at least 8 characters with an upper case letter, a lower case letter and a number.`
      );
    }
  }

  if (accounts[0].email === accounts[1].email) {
    throw new Error('The Super Admin and Admin accounts need different email addresses.');
  }

  console.log('Seeding Business CRM database...');

  // 1. Seed or find default company
  const company = await prisma.company.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: process.env.INITIAL_COMPANY_NAME || 'My Company',
      currency: 'INR',
    },
  });
  console.log(`Company created: ${company.name} (${company.id})`);

  // 2. Upsert permissions
  const permissionMap = new Map<string, string>();
  for (const perm of PERMISSIONS) {
    const p = await prisma.permission.upsert({
      where: { key: perm.key },
      update: { description: perm.description, module: perm.module },
      create: perm,
    });
    permissionMap.set(p.key, p.id);
  }
  console.log(`Seeded ${permissionMap.size} system permissions.`);

  // 3. Define Roles
  const rolesData = [
    {
      name: 'Administrator',
      description: 'Full system control and unrestricted access across all business modules',
      isSystem: true,
      permissionKeys: Array.from(permissionMap.keys()),
    },
    {
      name: 'Manager',
      description: 'Manage customers, leads, projects, tasks and business reports',
      isSystem: true,
      permissionKeys: [
        'dashboard.view', 'company.view', 'users.view',
        'leads.view', 'leads.create', 'leads.update', 'leads.convert',
        'customers.view', 'customers.create', 'customers.update',
        'projects.view', 'projects.create', 'projects.update',
        'tasks.view', 'tasks.create', 'tasks.update',
        'proposals.view', 'proposals.create', 'proposals.update',
        'estimates.view', 'estimates.create', 'estimates.update',
        'invoices.view', 'payments.view', 'expenses.view',
        'tickets.view', 'tickets.create', 'tickets.reply',
        'reports.view', 'reports.export',
        'attachments.view', 'attachments.upload', 'attachments.delete',
      ],
    },
    {
      name: 'Staff Member',
      description: 'Assigned projects, tasks and ticket support',
      isSystem: true,
      permissionKeys: [
        'dashboard.view',
        'projects.view', 'tasks.view', 'tasks.create', 'tasks.update',
        'tickets.view', 'tickets.reply',
      ],
    },
    {
      name: 'Finance User',
      description: 'Sales documents, invoices, payment recording and expenses',
      isSystem: true,
      permissionKeys: [
        'dashboard.view', 'customers.view',
        'proposals.view', 'estimates.view', 'contracts.view',
        'invoices.view', 'invoices.create', 'invoices.update', 'invoices.issue', 'invoices.void',
        'payments.view', 'payments.record',
        'expenses.view', 'expenses.create', 'expenses.update', 'expenses.approve',
        'reports.view', 'reports.export',
      ],
    },
    {
      name: 'Support User',
      description: 'Customer ticket queue and replies',
      isSystem: true,
      permissionKeys: [
        'dashboard.view', 'customers.view',
        'tickets.view', 'tickets.create', 'tickets.update', 'tickets.reply',
      ],
    },
    {
      name: 'Read-Only User',
      description: 'Inspect permitted business records with zero mutation rights',
      isSystem: true,
      permissionKeys: [
        'dashboard.view', 'company.view', 'users.view',
        'leads.view', 'customers.view', 'projects.view', 'tasks.view',
        'proposals.view', 'estimates.view', 'contracts.view',
        'invoices.view', 'payments.view', 'expenses.view',
        'tickets.view', 'reports.view',
      ],
    },
  ];

  const roleMap = new Map<string, string>();
  for (const roleDef of rolesData) {
    const role = await prisma.role.upsert({
      where: {
        companyId_name: {
          companyId: company.id,
          name: roleDef.name,
        },
      },
      update: {
        description: roleDef.description,
        isSystem: roleDef.isSystem,
      },
      create: {
        companyId: company.id,
        name: roleDef.name,
        description: roleDef.description,
        isSystem: roleDef.isSystem,
      },
    });
    roleMap.set(role.name, role.id);

    // Link permissions
    for (const key of roleDef.permissionKeys) {
      const permId = permissionMap.get(key);
      if (permId) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permId,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permId,
          },
        });
      }
    }
  }
  console.log(`Seeded ${rolesData.length} core roles with permission mappings.`);

  // 4. Create the two administrator accounts (credentials were checked at the start of this run).
  const adminRole = roleMap.get('Administrator')!;
  for (const account of accounts) {
    const passwordHash = await bcrypt.hash(account.password, 12);
    const user = await prisma.user.upsert({
      where: { companyId_email: { companyId: company.id, email: account.email } },
      // Re-running the seed never resets a password that someone has already changed.
      update: { name: account.label, status: UserStatus.ACTIVE },
      create: {
        companyId: company.id,
        name: account.label,
        email: account.email,
        passwordHash,
        status: UserStatus.ACTIVE,
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: adminRole } },
      update: {},
      create: { userId: user.id, roleId: adminRole },
    });
    console.log(`${account.label} ready: ${account.email}`);
  }

  console.log('Passwords are set from the environment. Change them after the first sign-in.');
  console.log('Database seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
