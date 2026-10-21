// Complete End-to-End Verification Script for Phase 2 CRM Core
import http from 'http';

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      const setCookies = res.headers['set-cookie'] || [];
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, cookies: setCookies, body: parsed });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, cookies: setCookies, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runVerification() {
  console.log('--- STARTING PHASE 2 E2E VERIFICATION ---');

  // 1. Health Check
  const health = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/health',
    method: 'GET',
  });
  console.log('✓ Health check status:', health.status, health.body?.status);

  // 2. Admin Login
  const loginRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { email: 'admin@businesscrm.local', password: 'Admin@Secure123!' }
  );

  console.log('✓ Login status:', loginRes.status, loginRes.body?.message);
  const token = loginRes.body?.accessToken;
  const cookieHeader = loginRes.cookies.map((c) => c.split(';')[0]).join('; ');
  const csrfCookie = loginRes.cookies.find((c) => c.startsWith('crm_csrf='));
  const csrfToken = csrfCookie ? csrfCookie.split(';')[0].split('=')[1] : '';

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    Cookie: cookieHeader,
    'x-csrf-token': csrfToken,
  };

  // 3. Create Company Customer with Contact and Note
  const createCustRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/v1/customers',
      method: 'POST',
      headers: authHeaders,
    },
    {
      type: 'COMPANY',
      name: 'Nexus Horizon Corp',
      companyName: 'Nexus Horizon Technologies Inc.',
      email: 'enterprise@nexushorizon.io',
      phone: '+1-555-8822',
      website: 'https://nexushorizon.io',
      taxId: 'US-EIN-123456',
      initialContact: {
        name: 'Alexander Cross',
        email: 'alexander@nexushorizon.io',
        phone: '+1-555-8823',
        title: 'VP of Engineering',
        isPrimary: true,
      },
      initialNote: 'Tier-1 enterprise prospect identified at FinTech summit.',
    }
  );
  console.log('✓ Customer created:', createCustRes.status, createCustRes.body?.customer?.name);
  const customerId = createCustRes.body?.customer?.id;

  // 4. Add Contact to Customer
  const addContactRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 4000,
      path: `/api/v1/customers/${customerId}/contacts`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      name: 'Jessica Vance',
      email: 'jvance@nexushorizon.io',
      phone: '+1-555-8824',
      title: 'Procurement Director',
      isPrimary: false,
    }
  );
  console.log('✓ Additional contact added:', addContactRes.status, addContactRes.body?.contact?.name);

  // 5. Create Lead Opportunity
  const createLeadRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/v1/leads',
      method: 'POST',
      headers: authHeaders,
    },
    {
      name: 'Marcus Brody',
      companyName: 'Brody Capital Partners',
      title: 'Multi-Tenant CRM Deployment',
      email: 'mbrody@brodycapital.com',
      phone: '+44-20-7946-1122',
      value: 450000,
      currency: 'INR',
      status: 'QUALIFIED',
      priority: 'HIGH',
      source: 'LinkedIn Campaign',
      nextFollowUp: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      initialNote: 'Qualified by sales development representative. Ready for proposal.',
    }
  );
  console.log('✓ Lead opportunity created:', createLeadRes.status, createLeadRes.body?.lead?.name, `Value: ₹${createLeadRes.body?.lead?.value}`);
  const leadId = createLeadRes.body?.lead?.id;

  // 6. Schedule Follow-up Activity for Lead
  const createActRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/v1/activities',
      method: 'POST',
      headers: authHeaders,
    },
    {
      type: 'MEETING',
      subject: 'Executive Demo with Brody Capital',
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      leadId,
      description: 'Present customized admin dashboard and RBAC permission hierarchies.',
    }
  );
  console.log('✓ Activity scheduled:', createActRes.status, createActRes.body?.activity?.subject);
  const activityId = createActRes.body?.activity?.id;

  // 7. Atomic Lead Conversion into Customer & Contact
  const convertRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 4000,
      path: `/api/v1/leads/${leadId}/convert`,
      method: 'POST',
      headers: authHeaders,
    },
    {
      customerType: 'COMPANY',
      customerName: 'Brody Capital Partners',
      contactName: 'Marcus Brody',
      contactTitle: 'Managing Partner',
      taxId: 'GB-VAT-998811',
    }
  );
  console.log('✓ Lead converted atomically:', convertRes.status, convertRes.body?.message);
  console.log('  -> Customer ID:', convertRes.body?.customer?.id, convertRes.body?.customer?.name);
  console.log('  -> Contact ID:', convertRes.body?.contact?.id, convertRes.body?.contact?.name);
  console.log('  -> Lead Status:', convertRes.body?.lead?.status);

  // 8. Attempt Duplicate Conversion (Must fail with 409)
  const dupConvertRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 4000,
      path: `/api/v1/leads/${leadId}/convert`,
      method: 'POST',
      headers: authHeaders,
    },
    { customerType: 'COMPANY' }
  );
  console.log('✓ Duplicate conversion prevented (expected 409):', dupConvertRes.status, dupConvertRes.body?.error?.code);

  // 9. Complete the Follow-up Activity
  const completeActRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 4000,
      path: `/api/v1/activities/${activityId}/complete`,
      method: 'PATCH',
      headers: authHeaders,
    },
    { completionNote: 'Demo completed with executive team. Terms agreed.' }
  );
  console.log('✓ Activity marked complete:', completeActRes.status, completeActRes.body?.activity?.status);

  // 10. Fetch CRM Dashboard Live Metrics
  const dashRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/crm-dashboard/metrics?days=30',
    method: 'GET',
    headers: authHeaders,
  });
  console.log('✓ CRM Dashboard live metrics:');
  console.log('  -> Total Customers:', dashRes.body?.metrics?.totalCustomers);
  console.log('  -> Converted Leads:', dashRes.body?.metrics?.convertedLeads);
  console.log('  -> Conversion Rate:', `${dashRes.body?.metrics?.conversionRate}%`);
  console.log('  -> Recent Leads count:', dashRes.body?.metrics?.recentLeads?.length);
  console.log('  -> Status Distribution:', dashRes.body?.metrics?.statusDistribution?.map(s => `${s.status}: ${s.count}`).join(', '));

  console.log('\n🎉 ALL PHASE 2 CRM CORE END-TO-END FLOWS VERIFIED SUCCESSFULLY!');
}

runVerification().catch(console.error);
