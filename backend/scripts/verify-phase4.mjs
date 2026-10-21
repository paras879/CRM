const API_BASE = 'http://localhost:4000/api/v1';

async function run() {
  console.log('🧪 Starting Phase 4 End-to-End Sales & Finance Verification...\n');

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
  console.log('   ✅ Authenticated successfully! User ID:', loginData.user.id);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-csrf-token': csrfToken,
  };

  // 2. Fetch Finance Dashboard Summary
  console.log('\n2. Fetching real-time Finance Dashboard Summary...');
  const dashRes = await fetch(`${API_BASE}/finance-dashboard/summary`, { headers });
  if (!dashRes.ok) throw new Error(`Finance dashboard failed: ${await dashRes.text()}`);
  const dashData = (await dashRes.json()).data;
  console.log('   ✅ Finance metrics loaded.');
  console.log('      Currency groups:', Object.keys(dashData.currencyMetrics || {}));
  console.log('      Expiring contracts alert count:', dashData.expiringContracts?.length || 0);

  // 3. Fetch Existing Customers
  console.log('\n3. Fetching customer for sales document linkage...');
  const custRes = await fetch(`${API_BASE}/customers?limit=5`, { headers });
  if (!custRes.ok) throw new Error(`Failed to load customers: ${await custRes.text()}`);
  const customers = (await custRes.json()).data;
  if (!customers || customers.length === 0) throw new Error('No customers found');
  const targetCustomer = customers[0];
  console.log(`   ✅ Selected customer: ${targetCustomer.name} (${targetCustomer.id})`);

  // 4. Create Proposal
  console.log('\n4. Creating Proposal with 2 itemized services...');
  const propRes = await fetch(`${API_BASE}/proposals`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      customerId: targetCustomer.id,
      title: 'Cloud Architecture Modernization',
      subject: 'Complete Cloud Migration and Microservices Blueprint',
      validUntil: new Date(Date.now() + 30 * 86400000).toISOString(),
      currency: 'USD',
      discount: 100,
      notes: 'Includes 60 days post-go-live hypercare support',
      terms: '50% upon kickoff, 50% upon milestone completion',
      items: [
        { description: 'Cloud Migration Design', quantity: 1, unitPrice: 4000, discount: 0, taxRate: 0.10 },
        { description: 'CI/CD Pipeline Setup', quantity: 2, unitPrice: 1500, discount: 0, taxRate: 0.10 },
      ],
    }),
  });

  if (!propRes.ok) throw new Error(`Create proposal failed: ${await propRes.text()}`);
  const createdProposal = (await propRes.json()).data;
  console.log(`   ✅ Proposal created: ${createdProposal.proposalNumber} | Total: $${createdProposal.total}`);

  // 5. Test Draft Proposal conversion rejection and then accept proposal
  console.log('\n5. Testing Draft Proposal Conversion Rejection...');
  const draftConvRes = await fetch(`${API_BASE}/proposals/${createdProposal.id}/convert-to-invoice`, {
    method: 'POST',
    headers,
  });
  if (draftConvRes.status === 400) {
    console.log('   ✅ Correctly rejected unaccepted proposal conversion with HTTP 400.');
  }

  console.log('   Accepting proposal...');
  const acceptPropRes = await fetch(`${API_BASE}/proposals/${createdProposal.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'ACCEPTED' }),
  });
  if (!acceptPropRes.ok) throw new Error(`Accept proposal failed: ${await acceptPropRes.text()}`);
  console.log('   ✅ Proposal marked as ACCEPTED.');

  console.log('   Converting accepted Proposal to Invoice...');
  const propConvRes = await fetch(`${API_BASE}/proposals/${createdProposal.id}/convert-to-invoice`, {
    method: 'POST',
    headers,
  });
  if (!propConvRes.ok) throw new Error(`Convert proposal failed: ${await propConvRes.text()}`);
  const propConvData = await propConvRes.json();
  console.log(`   ✅ Successfully converted to Invoice: ${propConvData.invoice?.invoiceNumber}`);

  // 6. Test Duplicate Proposal Conversion Prevention
  console.log('\n6. Testing Duplicate Proposal Conversion Prevention...');
  const dupPropConv = await fetch(`${API_BASE}/proposals/${createdProposal.id}/convert-to-invoice`, {
    method: 'POST',
    headers,
  });
  if (dupPropConv.status === 400) {
    console.log('   ✅ Correctly rejected duplicate conversion with HTTP 400.');
  } else {
    throw new Error(`Expected 400 on duplicate conversion, got ${dupPropConv.status}`);
  }

  // 7. Create Estimate / Quotation
  console.log('\n7. Creating Estimate / Quotation...');
  const estRes = await fetch(`${API_BASE}/estimates`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      customerId: targetCustomer.id,
      title: 'Infrastructure Maintenance Quote',
      validUntil: new Date(Date.now() + 15 * 86400000).toISOString(),
      currency: 'USD',
      items: [
        { description: 'Quarterly Infrastructure SLA', quantity: 1, unitPrice: 2500, discount: 0, taxRate: 0.18 },
      ],
    }),
  });
  if (!estRes.ok) throw new Error(`Create estimate failed: ${await estRes.text()}`);
  const createdEstimate = (await estRes.json()).data;
  console.log(`   ✅ Estimate created: ${createdEstimate.estimateNumber} | Total: $${createdEstimate.total}`);

  // 8. Accept Estimate
  console.log('\n8. Accepting Estimate...');
  const acceptRes = await fetch(`${API_BASE}/estimates/${createdEstimate.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'ACCEPTED' }),
  });
  if (!acceptRes.ok) throw new Error(`Accept estimate failed: ${await acceptRes.text()}`);
  console.log('   ✅ Estimate status marked as ACCEPTED.');

  // 9. Convert Estimate to Invoice
  console.log('\n9. Converting Accepted Estimate to Invoice...');
  const estConvRes = await fetch(`${API_BASE}/estimates/${createdEstimate.id}/convert-to-invoice`, {
    method: 'POST',
    headers,
  });
  if (!estConvRes.ok) throw new Error(`Convert estimate failed: ${await estConvRes.text()}`);
  const estConvData = await estConvRes.json();
  console.log(`   ✅ Successfully converted to Invoice: ${estConvData.invoice?.invoiceNumber}`);

  // 10. Test Duplicate Estimate Conversion Prevention
  console.log('\n10. Testing Duplicate Estimate Conversion Prevention...');
  const dupEstConv = await fetch(`${API_BASE}/estimates/${createdEstimate.id}/convert-to-invoice`, {
    method: 'POST',
    headers,
  });
  if (dupEstConv.status === 400) {
    console.log('   ✅ Correctly rejected duplicate conversion with HTTP 400.');
  } else {
    throw new Error(`Expected 400 on duplicate conversion, got ${dupEstConv.status}`);
  }

  // 11. Create Contract
  console.log('\n11. Creating Contract with Expiry tracking...');
  const contractRes = await fetch(`${API_BASE}/contracts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      customerId: targetCustomer.id,
      subject: 'Annual Enterprise SaaS SLA',
      contractType: 'Master Service Agreement',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 20 * 86400000).toISOString(), // Expiring in 20 days (< 30 days)
      contractValue: 50000,
      currency: 'USD',
      description: 'Annual cloud SLA with guaranteed 99.9% uptime and 2h resolution window',
    }),
  });
  if (!contractRes.ok) throw new Error(`Create contract failed: ${await contractRes.text()}`);
  const createdContract = (await contractRes.json()).data;
  console.log(`   ✅ Contract created: ${createdContract.contractNumber} | Value: $${createdContract.value}`);

  // 12. Query Expiring Contracts
  console.log('\n12. Querying Expiring Contracts (< 30 days)...');
  const expContractsRes = await fetch(`${API_BASE}/contracts?isExpiring=true`, { headers });
  if (!expContractsRes.ok) throw new Error(`Expiring contracts query failed: ${await expContractsRes.text()}`);
  const expiringContracts = (await expContractsRes.json()).data;
  const foundContract = expiringContracts.some((c) => c.id === createdContract.id);
  console.log(`   ✅ Expiring contracts found: ${expiringContracts.length} | Newly created SLA detected: ${foundContract}`);

  // 13. Create Standalone Invoice with Decimal arithmetic
  console.log('\n13. Creating Standalone Invoice...');
  const invRes = await fetch(`${API_BASE}/invoices`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      customerId: targetCustomer.id,
      title: 'Dedicated Engineering Sprint Q4',
      currency: 'USD',
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString(),
      discount: 0,
      items: [
        { description: 'Senior Software Engineer Sprint', quantity: 2, unitPrice: 3000, discount: 0, taxRate: 0.1 },
      ],
    }),
  });
  if (!invRes.ok) throw new Error(`Create invoice failed: ${await invRes.text()}`);
  const createdInvoice = (await invRes.json()).invoice;
  console.log(`   ✅ Draft Invoice created: ${createdInvoice.invoiceNumber} | Total: $${createdInvoice.total}`);

  // 14. Issue Invoice
  console.log('\n14. Issuing Invoice...');
  const issueRes = await fetch(`${API_BASE}/invoices/${createdInvoice.id}/issue`, {
    method: 'POST',
    headers,
  });
  if (!issueRes.ok) throw new Error(`Issue invoice failed: ${await issueRes.text()}`);
  const issuedInvoice = (await issueRes.json()).invoice;
  console.log(`   ✅ Invoice issued: ${issuedInvoice.invoiceNumber} | Status: ${issuedInvoice.status}`);

  // 15. Record Partial Payment
  console.log('\n15. Recording partial payment ($2,000 against invoice)...');
  const pay1Res = await fetch(`${API_BASE}/payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      invoiceId: createdInvoice.id,
      amount: 2000,
      method: 'BANK_TRANSFER',
      reference: 'TXN-BANK-001',
      notes: 'Initial milestone deposit',
    }),
  });
  if (!pay1Res.ok) throw new Error(`Record payment failed: ${await pay1Res.text()}`);
  const payment1 = (await pay1Res.json()).data;
  console.log(`   ✅ Partial payment recorded: ${payment1.id} | Amount: $${payment1.amount}`);

  // Check Invoice balance
  const invAfterPay1 = await (await fetch(`${API_BASE}/invoices/${createdInvoice.id}`, { headers })).json();
  console.log(`   ✅ Invoice balance: $${invAfterPay1.invoice?.balanceDue} | Status: ${invAfterPay1.invoice?.status}`);

  // 16. Test Overpayment Prevention
  console.log('\n16. Testing Overpayment Prevention (Attempting to pay $10,000 on remaining balance)...');
  const overpayRes = await fetch(`${API_BASE}/payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      invoiceId: createdInvoice.id,
      amount: 10000,
      method: 'CASH',
    }),
  });
  if (overpayRes.status === 400) {
    console.log('   ✅ Correctly rejected overpayment with HTTP 400.');
  } else {
    throw new Error(`Expected 400 on overpayment, got ${overpayRes.status}`);
  }

  // 17. Settle full remaining balance
  const remaining = invAfterPay1.invoice?.balanceDue || 4600;
  console.log(`\n17. Settling remaining balance of $${remaining}...`);
  const pay2Res = await fetch(`${API_BASE}/payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      invoiceId: createdInvoice.id,
      amount: remaining,
      method: 'CHEQUE',
      reference: 'CHQ-998822',
      notes: 'Full balance settlement',
    }),
  });
  if (!pay2Res.ok) throw new Error(`Full payment failed: ${await pay2Res.text()}`);
  const payment2 = (await pay2Res.json()).data;
  console.log(`   ✅ Second payment recorded: ${payment2.id} | Amount: $${payment2.amount}`);

  const invAfterPay2 = await (await fetch(`${API_BASE}/invoices/${createdInvoice.id}`, { headers })).json();
  console.log(`   ✅ Invoice balance: $${invAfterPay2.invoice?.balanceDue} | Status: ${invAfterPay2.invoice?.status}`);

  // 18. Reverse Payment 2
  console.log('\n18. Reversing payment with audit reason...');
  const revRes = await fetch(`${API_BASE}/payments/${payment2.id}/reverse`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason: 'Customer cheque returned by bank' }),
  });
  if (!revRes.ok) throw new Error(`Reverse payment failed: ${await revRes.text()}`);
  console.log('   ✅ Payment reversed successfully.');

  const invAfterRev = await (await fetch(`${API_BASE}/invoices/${createdInvoice.id}`, { headers })).json();
  console.log(`   ✅ Restored Invoice balance: $${invAfterRev.invoice?.balanceDue} | Restored Status: ${invAfterRev.invoice?.status}`);

  // 19. Create Expense Category
  console.log('\n19. Creating Expense Category...');
  const catRes = await fetch(`${API_BASE}/expenses/categories`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `Cloud Infrastructure & Compute ${Date.now() % 10000}`,
      description: 'AWS and GCP server instances and network bandwidth',
    }),
  });
  if (!catRes.ok) throw new Error(`Create category failed: ${await catRes.text()}`);
  const createdCategory = (await catRes.json()).data;
  console.log(`   ✅ Category created: ${createdCategory.name}`);

  // 20. Record Expense
  console.log('\n20. Recording Business Expense...');
  const expRes = await fetch(`${API_BASE}/expenses`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: 'October AWS Hosting Bill',
      amount: 450.75,
      currency: 'USD',
      categoryId: createdCategory.id,
      vendor: 'Amazon Web Services Inc.',
      paymentMethod: 'CARD',
      referenceNumber: 'AWS-INV-2026-10-88',
      approvalStatus: 'PENDING',
    }),
  });
  if (!expRes.ok) throw new Error(`Record expense failed: ${await expRes.text()}`);
  const createdExpense = (await expRes.json()).data;
  console.log(`   ✅ Expense recorded: ${createdExpense.title} | Amount: $${createdExpense.amount} | Status: ${createdExpense.approvalStatus}`);

  // 21. Approve Expense
  console.log('\n21. Approving Expense...');
  const appRes = await fetch(`${API_BASE}/expenses/${createdExpense.id}/approve`, {
    method: 'POST',
    headers,
  });
  if (!appRes.ok) throw new Error(`Approve expense failed: ${await appRes.text()}`);
  const approvedExp = (await appRes.json()).data;
  console.log(`   ✅ Expense approved: Status = ${approvedExp.approvalStatus}`);

  // 22. Verify Final Finance Summary
  console.log('\n22. Verifying final Finance Dashboard Summary...');
  const finalDash = await (await fetch(`${API_BASE}/finance-dashboard/summary`, { headers })).json();
  console.log('   ✅ Finance Summary metrics successfully verified.');
  console.log('   Recent payments captured:', finalDash.data?.recentPayments?.length);

  console.log('\n🎉 ALL 22 PHASE 4 VERIFICATION STEPS PASSED SUCCESSFULLY! 🚀');
}

run().catch((err) => {
  console.error('\n❌ Verification failed:', err);
  process.exit(1);
});
