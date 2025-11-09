import express from 'express';

const app = express();
const PORT = Number.parseInt(process.env.PORT || '9090', 10);
const TENANT_ID = process.env.TENANT_ID || 'unknown';
const START_TIME = new Date().toISOString();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    message: 'Tenant Application',
    tenantId: TENANT_ID,
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    tenantId: TENANT_ID,
    uptime: process.uptime(),
  });
});

app.get('/inspect', (req, res) => {
  res.json({
    tenantId: TENANT_ID,
    startTime: START_TIME,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    env: {
      port: PORT,
      nodeVersion: process.version,
      platform: process.platform,
    },
  });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Tenant app running on port ${PORT}`);
  console.log(`Tenant ID: ${TENANT_ID}`);
  console.log('');
  console.log('Available endpoints:');
  console.log(`  GET http://localhost:${PORT}/`);
  console.log(`  GET http://localhost:${PORT}/health`);
  console.log(`  GET http://localhost:${PORT}/inspect`);
});

server.on('error', (error: Error) => {
  console.error('Server error:', error);
  process.exit(1);
});

