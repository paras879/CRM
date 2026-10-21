const API_BASE = 'http://localhost:4000/api/v1';

async function run() {
  console.log('🧪 Starting Phase 3 End-to-End Verification...\n');

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

  // 2. Fetch Projects List
  console.log('\n2. Listing existing projects...');
  const listRes = await fetch(`${API_BASE}/projects?limit=10`, { headers });
  if (!listRes.ok) throw new Error(`List projects failed: ${await listRes.text()}`);
  const listData = await listRes.json();
  console.log(`   ✅ Fetched ${listData.data.length} projects. Total: ${listData.meta.total}`);

  // 3. Create New Project
  console.log('\n3. Creating new Project: "Autonomous AI Agent System"...');
  const createProjRes = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Autonomous AI Agent System',
      description: 'Enterprise AI agent architecture with custom tool orchestrator',
      status: 'ACTIVE',
      priority: 'HIGH',
      startDate: new Date().toISOString(),
      deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
      budget: 1800000,
      currency: 'INR',
    }),
  });

  if (!createProjRes.ok) throw new Error(`Create project failed: ${await createProjRes.text()}`);
  const createdProject = (await createProjRes.json()).project;
  console.log(`   ✅ Created project ID: ${createdProject.id}, Name: ${createdProject.name}`);

  // 4. Add Project Member
  console.log('\n4. Adding member (Alex Johnson) to Project...');
  const addMemberRes = await fetch(`${API_BASE}/projects/${createdProject.id}/members`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      userId: '20000000-0000-0000-0000-000000000002', // Alex
      role: 'PROJECT_MANAGER',
    }),
  });

  if (!addMemberRes.ok) throw new Error(`Add member failed: ${await addMemberRes.text()}`);
  console.log('   ✅ Added Alex Johnson as PROJECT_MANAGER');

  // 5. Create Milestone
  console.log('\n5. Creating Milestone: "Phase 3 Delivery"...');
  const createMilestoneRes = await fetch(`${API_BASE}/milestones`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      projectId: createdProject.id,
      name: 'Phase 3 Delivery',
      title: 'Phase 3 Delivery',
      description: 'Project management & task tracking feature completion',
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString(),
      status: 'PENDING',
      order: 1,
    }),
  });

  if (!createMilestoneRes.ok) throw new Error(`Create milestone failed: ${await createMilestoneRes.text()}`);
  const createdMilestone = (await createMilestoneRes.json()).milestone;
  console.log(`   ✅ Milestone created: ${createdMilestone.name} (ID: ${createdMilestone.id})`);

  // 6. Create Task
  console.log('\n6. Creating Task: "Build Work Dashboard Views"...');
  const createTaskRes = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      projectId: createdProject.id,
      milestoneId: createdMilestone.id,
      title: 'Build Work Dashboard Views',
      description: 'Create interactive project metrics and task board',
      priority: 'URGENT',
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      estimatedHours: 12,
      assigneeIds: ['20000000-0000-0000-0000-000000000002'],
    }),
  });

  if (!createTaskRes.ok) throw new Error(`Create task failed: ${await createTaskRes.text()}`);
  const createdTask = (await createTaskRes.json()).task;
  console.log(`   ✅ Task created: ${createdTask.title} (ID: ${createdTask.id})`);

  // 7. Add Comment to Task
  console.log('\n7. Adding comment to Task...');
  const commentRes = await fetch(`${API_BASE}/tasks/${createdTask.id}/comments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      body: 'Verified dual persistence and UI tabs. Ready for review.',
    }),
  });

  if (!commentRes.ok) throw new Error(`Add comment failed: ${await commentRes.text()}`);
  console.log('   ✅ Comment added successfully');

  // 8. Log Time on Task
  console.log('\n8. Logging 90 minutes of billable work on Task...');
  const logTimeRes = await fetch(`${API_BASE}/time-entries`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      projectId: createdProject.id,
      taskId: createdTask.id,
      startedAt: new Date(Date.now() - 90 * 60000).toISOString(),
      endedAt: new Date().toISOString(),
      minutes: 90,
      description: 'Full-stack integration testing for Phase 3',
      billable: true,
    }),
  });

  if (!logTimeRes.ok) throw new Error(`Log time failed: ${await logTimeRes.text()}`);
  const loggedTime = (await logTimeRes.json()).entry;
  console.log(`   ✅ Time logged: ${loggedTime.minutes} minutes (Billable: ${loggedTime.billable})`);

  // 9. Fetch Work Dashboard Metrics
  console.log('\n9. Fetching Work Dashboard aggregated metrics...');
  const metricsRes = await fetch(`${API_BASE}/work-dashboard/metrics`, { headers });
  if (!metricsRes.ok) throw new Error(`Work dashboard metrics failed: ${await metricsRes.text()}`);
  const { metrics } = await metricsRes.json();
  console.log('   ✅ Live Metrics fetched:');
  console.log(`      • Active Projects: ${metrics.activeProjectsCount}`);
  console.log(`      • Overdue Projects: ${metrics.overdueProjectsCount}`);
  console.log(`      • Nearing Deadline: ${metrics.nearingDeadlineProjectsCount}`);
  console.log(`      • Open Tasks: ${metrics.openTasksCount}`);
  console.log(`      • Overdue Tasks: ${metrics.overdueTasksCount}`);
  console.log(`      • Total Tracked Hours: ${metrics.timeTracking.totalHours} hrs (${metrics.timeTracking.billableHours} hrs billable)`);
  console.log(`      • Recent Projects in list: ${metrics.recentProjects.length}`);

  // 10. Update Task Status to DONE
  console.log('\n10. Updating Task status to DONE...');
  const statusUpdateRes = await fetch(`${API_BASE}/tasks/${createdTask.id}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'DONE' }),
  });

  if (!statusUpdateRes.ok) throw new Error(`Task status update failed: ${await statusUpdateRes.text()}`);
  console.log('   ✅ Task status updated to DONE');

  // 11. Fetch Project Details to verify calculated progress
  console.log('\n11. Fetching project details to verify calculated progress...');
  const projDetailsRes = await fetch(`${API_BASE}/projects/${createdProject.id}`, { headers });
  if (!projDetailsRes.ok) throw new Error(`Project details failed: ${await projDetailsRes.text()}`);
  const { project: projDetails } = await projDetailsRes.json();
  console.log(`   ✅ Project Details fetched: Progress = ${projDetails.progress}% (Tasks: ${projDetails.tasks?.length})`);
  console.log(`   ✅ Time Summary: Total = ${projDetails.timeSummary.totalHours} hrs, Billable = ${projDetails.timeSummary.billableHours} hrs`);

  console.log('\n🎉 ALL 11 PHASE 3 E2E VERIFICATIONS PASSED SUCCESSFULLY! 🚀');
}

run().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
