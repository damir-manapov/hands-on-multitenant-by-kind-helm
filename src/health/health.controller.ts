import { Controller, Get } from '@nestjs/common';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8')) as {
  version: string;
};

interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
  version: string;
}

@Controller('health')
export class HealthController {
  private readonly startTime: number;
  private readonly version: string;

  constructor() {
    this.startTime = Date.now();
    this.version = packageJson.version;
  }

  @Get()
  getHealth(): HealthResponse {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: this.version,
    };
  }
}
