import { Component, OnInit, OnDestroy, signal, computed, isDevMode } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HealthService } from '../services/health';
import { ServiceStatus } from '../models/health.model';
import { LogViewer } from './log-viewer';
import { Subscription, interval, of } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, LogViewer],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit, OnDestroy {
  activeEnv = signal('dev');
  services = signal<ServiceStatus[]>([]);
  loading = signal(false);
  lastChecked = signal<Date | null>(null);
  useMock = signal(isDevMode());

  envKeys: string[] = [];
  private refreshSub?: Subscription;

  upCount = computed(() => this.services().filter(s => s.status === 'up').length);
  downCount = computed(() => this.services().filter(s => s.status === 'down').length);
  dbCount = computed(() => {
    return this.services().reduce((count, s) => {
      return count + (s.databases?.filter(d => d.status === 'up').length || 0);
    }, 0);
  });

  constructor(public healthService: HealthService) {
    this.envKeys = Object.keys(this.healthService.environments);
  }

  ngOnInit() {
    this.refresh();
    this.refreshSub = interval(30000).subscribe(() => this.refresh());
  }

  ngOnDestroy() {
    this.refreshSub?.unsubscribe();
  }

  switchEnv(env: string) {
    this.activeEnv.set(env);
    this.refresh();
  }

  toggleMock() {
    this.useMock.set(!this.useMock());
    this.refresh();
  }

  refresh() {
    this.loading.set(true);

    const source$ = this.useMock()
      ? of(this.getMockData())
      : this.healthService.checkAllServices(this.activeEnv());

    source$.subscribe(results => {
      this.services.set(results);
      this.lastChecked.set(new Date());
      this.loading.set(false);
    });
  }

  private getMockData(): ServiceStatus[] {
    const env = this.activeEnv();
    const cfg = this.healthService.environments[env];
    if (!cfg) return [];
    const find = (id: string) => cfg.services.find(s => s.id === id);

    return [
      {
        id: 'ucgagent-api', name: 'UCG Agent API', type: 'api', status: 'up',
        responseTime: 200, url: `/proxy/${env}/ucgagent/Health/ping`,
        appUrl: find('ucgagent-api')?.appUrl,
        healthUrl: find('ucgagent-api')?.healthUrl,
        swaggerUrl: find('ucgagent-api')?.swaggerUrl,
        databases: [{ name: 'MSSQL', status: 'up', server: 'agritec-dev-mssql:1433', database: 'UCGDEV', version: 'SQL Server 2022' }]
      },
      {
        id: 'diary-api', name: 'Diary API', type: 'api', status: 'up',
        responseTime: 150, url: `/proxy/${env}/diary/api/health`,
        appUrl: find('diary-api')?.appUrl,
        healthUrl: find('diary-api')?.healthUrl,
        swaggerUrl: find('diary-api')?.swaggerUrl,
        databases: [
          { name: 'Couchbase', status: 'up', database: 'Infocap (UCG)' },
          { name: 'MSSQL', status: 'up', server: 'agritec-dev-mssql:1433', database: 'UCGDEV' }
        ]
      },
      {
        id: 'unified-ui', name: 'Unified UI', type: 'ui', status: 'up',
        responseTime: 90,
        url: `/proxy/${env}/unified/version`,
        appUrl: find('unified-ui')?.appUrl,
      },
    ];
  }

  getApiServices(): ServiceStatus[] {
    return this.services().filter(s => s.type === 'api');
  }

  getLoggableServices() {
    const env = this.activeEnv();
    const config = this.healthService.environments[env];
    return config?.services.filter(s => s.logsUrl) || [];
  }
}
