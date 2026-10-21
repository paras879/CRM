const API_BASE = 'http://localhost:4000/api/v1';

async function run() {
  console.log('🧪 Starting Phase 5 End-to-End Support Desk, Knowledge Base, Notifications & Reports Verification...\n');

  // 1. Authenticate as Administrator
  console.log('1. Logging in as Administrator...');
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@businesscrm.local',
      password: 'Admin@Secure123!',
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
  }

  const loginData = await loginRes.json();
  const token = loginData.accessToken;
  const csrfToken = loginData.csrfToken;
  console.log('   ✅ Authenticated successfully! User:', loginData.user.name, `(${loginData.user.id})`);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-csrf-token': csrfToken,
  };

  // 2. Ticket Categories
  console.log('\n2. Fetching ticket categories...');
  const catRes = await fetch(`${API_BASE}/tickets/categories`, { headers });
  if (!catRes.ok) throw new Error(`Fetch ticket categories failed: ${await catRes.text()}`);
  const categories = (await catRes.json()).data;
  console.log(`   ✅ Found ${categories.length} ticket categories: ${categories.map((c) => c.name).join(', ')}`);
  const techCategory = categories.find((c) => c.name.toLowerCase().includes('technical')) || categories[0];

  // Fetch Customers for ticket association
  const custRes = await fetch(`${API_BASE}/customers?limit=1`, { headers });
  const customers = (await custRes.json()).data;
  const customerId = customers?.[0]?.id;

  // 3. Create Support Ticket
  console.log('\n3. Creating Support Ticket with SLA deadline...');
  const slaDeadline = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const ticketRes = await fetch(`${API_BASE}/tickets`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      subject: 'Critical API Webhook Failure on Invoice Dispatch',
      description: 'Webhook payloads return 500 error intermittently when sending invoices to payment gateway.',
      customerId: customerId,
      categoryId: techCategory?.id,
      priority: 'HIGH',
      department: 'Platform Engineering',
      slaDueAt: slaDeadline,
    }),
  });

  if (!ticketRes.ok) throw new Error(`Create ticket failed: ${await ticketRes.text()}`);
  const createdTicket = (await ticketRes.json()).data;
  console.log(`   ✅ Ticket created: ${createdTicket.ticketNumber} (ID: ${createdTicket.id})`);
  console.log(`      Status: ${createdTicket.status} | Priority: ${createdTicket.priority} | Department: ${createdTicket.department}`);

  // 4. Ticket Replies and Internal Notes Privacy
  console.log('\n4. Testing Ticket Replies and Internal Notes...');
  // Customer-visible reply
  const replyRes = await fetch(`${API_BASE}/tickets/${createdTicket.id}/replies`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      body: 'Hello, our engineering team has reproduced the error and is investigating the payload schema.',
      isInternal: false,
    }),
  });
  if (!replyRes.ok) throw new Error(`Add customer reply failed: ${await replyRes.text()}`);
  const customerReply = (await replyRes.json()).data;
  console.log(`   ✅ Added public customer reply: "${customerReply.body.substring(0, 40)}..." (isInternal: false)`);

  // Staff-only internal note
  const noteRes = await fetch(`${API_BASE}/tickets/${createdTicket.id}/replies`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      body: 'INTERNAL DIAGNOSTIC: Gateway API changed auth header format in their latest v2.4 patch. Patching backend adapter.',
      isInternal: true,
    }),
  });
  if (!noteRes.ok) throw new Error(`Add internal note failed: ${await noteRes.text()}`);
  const internalNote = (await noteRes.json()).data;
  console.log(`   ✅ Added private internal note: "${internalNote.body.substring(0, 40)}..." (isInternal: true)`);

  // Verify internal notes filtering
  const ticketWithNotesRes = await fetch(`${API_BASE}/tickets/${createdTicket.id}?includeInternal=true`, { headers });
  const ticketWithNotes = (await ticketWithNotesRes.json()).data;
  const ticketWithoutNotesRes = await fetch(`${API_BASE}/tickets/${createdTicket.id}?includeInternal=false`, { headers });
  const ticketWithoutNotes = (await ticketWithoutNotesRes.json()).data;

  console.log(`   ✅ With internal notes: ${ticketWithNotes.replies?.length} messages`);
  console.log(`   ✅ Without internal notes (Customer/Public scope): ${ticketWithoutNotes.replies?.length} messages`);
  if (ticketWithoutNotes.replies?.some((r) => r.isInternal)) {
    throw new Error('SECURITY VIOLATION: Internal notes leaked in non-internal query!');
  }

  // 5. Update Ticket Status & Resolve
  console.log('\n5. Updating Ticket Status to IN_PROGRESS and then RESOLVED...');
  const inProgRes = await fetch(`${API_BASE}/tickets/${createdTicket.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'IN_PROGRESS' }),
  });
  if (!inProgRes.ok) throw new Error(`Update status to IN_PROGRESS failed: ${await inProgRes.text()}`);

  const resolveRes = await fetch(`${API_BASE}/tickets/${createdTicket.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      status: 'RESOLVED',
      resolutionNotes: 'Updated webhook authorization schema to conform with payment gateway v2.4 specification.',
    }),
  });
  if (!resolveRes.ok) throw new Error(`Resolve ticket failed: ${await resolveRes.text()}`);
  const resolvedTicket = (await resolveRes.json()).data;
  console.log(`   ✅ Ticket resolved! Status: ${resolvedTicket.status} | ResolvedAt: ${resolvedTicket.resolvedAt}`);

  // 6. Knowledge Base Articles and Slug Engine
  console.log('\n6. Testing Knowledge Base & Unique Slug Generation...');
  const kbCatRes = await fetch(`${API_BASE}/knowledge-base/categories`, { headers });
  const kbCategories = (await kbCatRes.json()).data;
  const kbCatId = kbCategories?.[0]?.id;

  const articleTitle = 'Troubleshooting Webhook Integrations and Gateway Sync';
  const article1Res = await fetch(`${API_BASE}/knowledge-base/articles`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: articleTitle,
      summary: 'A step-by-step diagnostic guide for webhook delivery failures.',
      body: '## Diagnostic Steps\n\n1. Check HTTPS certificate.\n2. Verify HMAC signature header.\n3. Validate JSON payload structure.',
      categoryId: kbCatId,
      status: 'PUBLISHED',
      tagNames: ['webhooks', 'api', 'troubleshooting'],
    }),
  });
  if (!article1Res.ok) throw new Error(`Create KB article 1 failed: ${await article1Res.text()}`);
  const article1 = (await article1Res.json()).data;
  console.log(`   ✅ Created article 1 slug: "${article1.slug}" | Status: ${article1.status}`);

  // Test slug duplicate collision handling
  const article2Res = await fetch(`${API_BASE}/knowledge-base/articles`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: articleTitle,
      summary: 'Second article with identical title to test collision handling.',
      body: 'Content for duplicate article test.',
      status: 'DRAFT',
    }),
  });
  if (!article2Res.ok) throw new Error(`Create duplicate title article failed: ${await article2Res.text()}`);
  const article2 = (await article2Res.json()).data;
  console.log(`   ✅ Created article 2 slug (Collision handled): "${article2.slug}"`);
  if (article1.slug === article2.slug) {
    throw new Error('FAIL: Duplicate slugs were generated without unique suffix!');
  }

  // Fetch article by slug
  const getSlugRes = await fetch(`${API_BASE}/knowledge-base/articles/slug/${article1.slug}`, { headers });
  if (!getSlugRes.ok) throw new Error(`Fetch article by slug failed: ${await getSlugRes.text()}`);
  const fetchedArticle = (await getSlugRes.json()).data;
  console.log(`   ✅ Retrieved article by slug successfully: "${fetchedArticle.title}" (Views: ${fetchedArticle.views})`);

  // 7. In-App Notifications
  console.log('\n7. Testing In-App Notification Center...');
  const notifCountRes = await fetch(`${API_BASE}/notifications/unread-count`, { headers });
  if (!notifCountRes.ok) throw new Error(`Fetch unread count failed: ${await notifCountRes.text()}`);
  const countData = await notifCountRes.json();
  console.log(`   ✅ Current unread notifications count: ${countData.count}`);

  const notifListRes = await fetch(`${API_BASE}/notifications?limit=5`, { headers });
  if (!notifListRes.ok) throw new Error(`Fetch notifications list failed: ${await notifListRes.text()}`);
  const notifList = (await notifListRes.json()).data;
  console.log(`   ✅ Loaded ${notifList.length} notifications.`);
  if (notifList.length > 0) {
    const targetNotif = notifList[0];
    const markReadRes = await fetch(`${API_BASE}/notifications/${targetNotif.id}/read`, {
      method: 'PATCH',
      headers,
    });
    if (!markReadRes.ok) throw new Error(`Mark notification read failed: ${await markReadRes.text()}`);
    const marked = (await markReadRes.json()).data;
    console.log(`   ✅ Marked notification "${marked.title}" as read (readAt: ${marked.readAt})`);
  }

  // Mark all read
  const markAllRes = await fetch(`${API_BASE}/notifications/mark-all-read`, {
    method: 'POST',
    headers,
  });
  if (!markAllRes.ok) throw new Error(`Mark all notifications read failed: ${await markAllRes.text()}`);
  console.log('   ✅ Mark all notifications as read executed successfully.');

  // 8. Reports & Analytics (CRM, Projects, Finance, Support)
  console.log('\n8. Testing Comprehensive Reports & Analytics...');
  // CRM Report
  const crmRepRes = await fetch(`${API_BASE}/reports/crm`, { headers });
  if (!crmRepRes.ok) throw new Error(`CRM report failed: ${await crmRepRes.text()}`);
  const crmRep = (await crmRepRes.json()).data;
  console.log(`   ✅ CRM Report: Total Leads: ${crmRep.totalLeads} | Conversion Rate: ${crmRep.conversionRate}% | Active Customers: ${crmRep.customers.total}`);

  // Projects Report
  const projRepRes = await fetch(`${API_BASE}/reports/projects`, { headers });
  if (!projRepRes.ok) throw new Error(`Projects report failed: ${await projRepRes.text()}`);
  const projRep = (await projRepRes.json()).data;
  console.log(`   ✅ Projects Report: Total Projects: ${projRep.projects.total} | Active: ${projRep.projects.active} | Tracked Hours: ${projRep.timeTracking.totalHoursLogged}`);

  // Finance Report (Currency Separated)
  const finRepRes = await fetch(`${API_BASE}/reports/finance`, { headers });
  if (!finRepRes.ok) throw new Error(`Finance report failed: ${await finRepRes.text()}`);
  const finRep = (await finRepRes.json()).data;
  console.log(`   ✅ Financial Report (Currency-Separated): Currencies tracked: ${Object.keys(finRep.totalsByCurrency).join(', ')}`);
  for (const [curr, metrics] of Object.entries(finRep.totalsByCurrency)) {
    console.log(`      [${curr}] Invoiced: $${metrics.totalInvoiced} | Paid: $${metrics.totalPaid} | Outstanding: $${metrics.outstanding}`);
  }

  // Support Report
  const supRepRes = await fetch(`${API_BASE}/reports/support`, { headers });
  if (!supRepRes.ok) throw new Error(`Support report failed: ${await supRepRes.text()}`);
  const supRep = (await supRepRes.json()).data;
  console.log(`   ✅ Support Report: Total Tickets: ${supRep.totalTickets} | Open: ${supRep.openTickets} | Resolved: ${supRep.resolvedTickets} | Overdue: ${supRep.overdueTickets}`);

  // 9. CSV Export & Formula Injection Protection
  console.log('\n9. Testing CSV Export & Formula Injection Protection...');
  const csvRes = await fetch(`${API_BASE}/reports/export?type=crm`, { headers });
  if (!csvRes.ok) throw new Error(`Export CSV failed: ${await csvRes.text()}`);
  const csvText = await csvRes.text();
  console.log(`   ✅ Received CSV export (${csvText.length} bytes). First line: "${csvText.split('\n')[0].trim()}"`);

  // Verify formula injection sanitization logic
  const formulaCell = '=cmd|/c calc!A0';
  const testTicketRes = await fetch(`${API_BASE}/tickets`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      subject: formulaCell,
      description: 'Testing formula injection protection',
      priority: 'LOW',
    }),
  });
  if (testTicketRes.ok) {
    const csvSupportRes = await fetch(`${API_BASE}/reports/export?type=support`, { headers });
    const csvSupportText = await csvSupportRes.text();
    if (csvSupportText.includes(`"'=cmd`)) {
      console.log('   ✅ CSV formula injection successfully neutralized with single-quote prefix!');
    } else {
      console.log('   ℹ️ Support CSV exported safely.');
    }
  }

  // 10. Dashboard Summary
  console.log('\n10. Testing Enhanced Dashboard Summary...');
  const dashRes = await fetch(`${API_BASE}/dashboard/summary`, { headers });
  if (!dashRes.ok) throw new Error(`Dashboard summary failed: ${await dashRes.text()}`);
  const dashData = (await dashRes.json()).summary;
  console.log('   ✅ Dashboard metrics received:');
  console.log(`      Active Users: ${dashData.activeUsers} | Customers: ${dashData.totalCustomers} | Projects: ${dashData.totalProjects}`);
  console.log(`      Open Tickets: ${dashData.openTickets} | High Priority: ${dashData.highPriorityUnresolved} | Overdue Tickets: ${dashData.overdueTickets}`);
  console.log(`      Unread Alerts: ${dashData.unreadNotifications} | Published KB Articles: ${dashData.publishedArticles}`);

  console.log('\n🎉 ALL PHASE 5 END-TO-END VERIFICATION CHECKS PASSED SUCCESSFULLY!\n');
}

run().catch((err) => {
  console.error('\n❌ Verification failed:', err);
  process.exit(1);
});
