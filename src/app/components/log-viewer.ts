import { Component, Input, signal, isDevMode } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HealthService } from '../services/health';
import { ServiceConfig, LogFile } from '../models/health.model';
import { of } from 'rxjs';

@Component({
  selector: 'app-log-viewer',
  imports: [CommonModule, FormsModule],
  templateUrl: './log-viewer.html',
  styleUrl: './log-viewer.css',
})
export class LogViewer {
  @Input() services: ServiceConfig[] = [];
  @Input() useMock = false;

  selectedService = signal<ServiceConfig | null>(null);
  logFiles = signal<LogFile[]>([]);
  selectedFile = signal<string>('');
  logContent = signal<string>('');
  loadingFiles = signal(false);
  loadingContent = signal(false);

  constructor(private healthService: HealthService) {}

  onServiceChange(serviceId: string) {
    const svc = this.services.find(s => s.id === serviceId) || null;
    this.selectedService.set(svc);
    this.logFiles.set([]);
    this.selectedFile.set('');
    this.logContent.set('');

    if (!svc) return;

    this.loadingFiles.set(true);

    const source$ = this.useMock
      ? of(this.getMockLogFiles(svc.id))
      : this.healthService.getLogFiles(svc.logsUrl!);

    source$.subscribe(files => {
      this.logFiles.set(files);
      this.loadingFiles.set(false);
    });
  }

  viewLog() {
    const svc = this.selectedService();
    const file = this.selectedFile();
    if (!svc || !file) return;

    this.loadingContent.set(true);

    const source$ = this.useMock
      ? of(this.getMockLogContent(svc.id))
      : this.healthService.getLogContent(svc.logsUrl!, file);

    source$.subscribe(content => {
      this.logContent.set(content);
      this.loadingContent.set(false);
    });
  }

  downloadLog() {
    const svc = this.selectedService();
    const file = this.selectedFile();
    if (!svc || !file) return;

    if (this.useMock) {
      const content = this.logContent() || this.getMockLogContent(svc.id);
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const url = this.healthService.getLogDownloadUrl(svc.logsUrl!, file);
    window.open(url, '_blank');
  }

  private getMockLogFiles(serviceId: string): LogFile[] {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = serviceId === 'agritec-api' ? 'agritec' : 'log';
    const ext = serviceId === 'agritec-api' ? '.log' : '.txt';

    return [
      { name: `${prefix}-${today}${ext}`, size: '42.3 KB', lastModified: new Date().toISOString().slice(0, 19).replace('T', ' ') },
      { name: `${prefix}-${yesterday}${ext}`, size: '128.7 KB', lastModified: new Date(Date.now() - 86400000).toISOString().slice(0, 19).replace('T', ' ') },
      { name: `${prefix}-error-${today}${ext}`, size: '8.1 KB', lastModified: new Date().toISOString().slice(0, 19).replace('T', ' ') },
    ];
  }

  private getMockLogContent(serviceId: string): string {
    const ts = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
    const lines = [
      `${ts()} [INF] Application started. Hosting environment: Production`,
      `${ts()} [INF] Now listening on: http://[::]:5000`,
      `${ts()} [INF] HTTP GET /health responded 200 in 12.3ms`,
      `${ts()} [INF] HTTP GET /api/v1/farms responded 200 in 45.6ms`,
      `${ts()} [WRN] Slow query detected: GetFarmsByRegion took 2341ms`,
      `${ts()} [INF] HTTP POST /api/v1/crops responded 201 in 89.2ms`,
      `${ts()} [INF] Health check postgresql: Healthy (12ms)`,
      `${ts()} [INF] Health check dataprotection: Healthy (0ms)`,
      `${ts()} [ERR] Failed to process request: System.TimeoutException`,
      `   at Npgsql.NpgsqlConnector.Open(NpgsqlTimeout timeout)`,
      `   at Npgsql.NpgsqlConnection.Open()`,
      `${ts()} [INF] HTTP GET /api/v1/users/me responded 200 in 23.4ms`,
      `${ts()} [INF] gRPC call agritec.FarmService/GetFarm completed in 15ms`,
      `${ts()} [INF] HTTP GET /health responded 200 in 8.1ms`,
      `${ts()} [WRN] Cache miss for key: farm_regions_all`,
      `${ts()} [INF] HTTP GET /api/v1/parcels?farmId=42 responded 200 in 67.8ms`,
    ];
    return lines.join('\n');
  }
}
