import http from 'http';

const pages = [
  '/login',
  '/dashboard',
  '/crm/dashboard',
  '/crm/leads',
  '/crm/customers',
  '/crm/activities',
];

for (const path of pages) {
  const req = http.get(`http://localhost:3000${path}`, (res) => {
    console.log(`Frontend route ${path} -> HTTP ${res.statusCode}`);
  });
  req.on('error', (e) => console.error(`Error on ${path}:`, e.message));
}
