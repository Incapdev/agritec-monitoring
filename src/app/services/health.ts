import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of, map, catchError, timeout } from 'rxjs';
import { EnvironmentConfig, ServiceConfig, ServiceStatus, DatabaseStatus, LogFile } from '../models/health.model';

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly TIMEOUT = 8000;

  readonly environments: Record<string, EnvironmentConfig> = {
    dev: {
      label: 'DEV',
      services: [
        {
          id: 'ucgagent-api', name: 'UCG Agent API', type: 'api',
          healthUrl: '/proxy/dev/ucgagent/Health/ping', logsUrl: '/logs/ucgagent-dev/',
          appUrl: 'https://dev.agritec.earth/ucg-api/',
          healthPageUrl: 'https://dev.agritec.earth/ucg-api/Health/ping',
          swaggerUrl: 'https://dev.agritec.earth/ucg-api/swagger',
        },
        {
          id: 'diary-api', name: 'Diary API', type: 'api',
          healthUrl: '/proxy/dev/diary/api/health', logsUrl: '/logs/diary-dev/',
          appUrl: 'https://dev.agritec.earth/diary-api/',
          healthPageUrl: 'https://dev.agritec.earth/diary-api/api/health',
          swaggerUrl: 'https://dev.agritec.earth/diary-api/swagger',
        },
        {
          id: 'unified-ui', name: 'Unified UI', type: 'ui',
          healthUrl: '/proxy/dev/unified/version',
          appUrl: 'https://dev.agritec.earth',
        },
      ]
    },
    uat: {
      label: 'UAT',
      services: [
        {
          id: 'ucgagent-api', name: 'UCG Agent API', type: 'api',
          healthUrl: '/proxy/uat/ucgagent/Health/ping', logsUrl: '/logs/ucgagent-uat/',
          appUrl: 'https://uat.agritec.earth/ucg-api/',
          healthPageUrl: 'https://uat.agritec.earth/ucg-api/Health/ping',
          swaggerUrl: 'https://uat.agritec.earth/ucg-api/swagger',
        },
        {
          id: 'diary-api', name: 'Diary API', type: 'api',
          healthUrl: '/proxy/uat/diary/api/health', logsUrl: '/logs/diary-uat/',
          appUrl: 'https://uat.agritec.earth/diary-api/',
          healthPageUrl: 'https://uat.agritec.earth/diary-api/api/health',
          swaggerUrl: 'https://uat.agritec.earth/diary-api/swagger',
        },
        {
          id: 'unified-ui', name: 'Unified UI', type: 'ui',
          healthUrl: '/proxy/uat/unified/version',
          appUrl: 'https://uat.agritec.earth',
        },
      ]
    }
  };

  constructor(private http: HttpClient) {}

  checkService(service: ServiceConfig): Observable<ServiceStatus> {
    const start = Date.now();

    return this.http.get(service.healthUrl, { observe: 'response', responseType: 'text' }).pipe(
      timeout(this.TIMEOUT),
      map(response => {
        const elapsed = Date.now() - start;
        let body: any = null;
        try { body = JSON.parse(response.body || ''); } catch { body = response.body; }
        const databases = this.extractDatabases(service.id, body);

        return {
          id: service.id,
          name: service.name,
          type: service.type,
          status: 'up' as const,
          responseTime: elapsed,
          url: service.healthUrl,
          detail: body,
          databases,
          appUrl: service.appUrl,
          healthPageUrl: service.healthPageUrl,
          swaggerUrl: service.swaggerUrl,
        };
      }),
      catchError(err => {
        const elapsed = Date.now() - start;
        return of({
          id: service.id,
          name: service.name,
          type: service.type,
          status: 'down' as const,
          responseTime: elapsed < this.TIMEOUT ? elapsed : undefined,
          url: service.healthUrl,
          error: err.status === 0 ? 'Connection refused' : `HTTP ${err.status}: ${err.statusText}`,
          appUrl: service.appUrl,
          healthPageUrl: service.healthPageUrl,
          swaggerUrl: service.swaggerUrl,
        });
      })
    );
  }

  checkAllServices(env: string): Observable<ServiceStatus[]> {
    const config = this.environments[env];
    if (!config) return of([]);
    return forkJoin(config.services.map(s => this.checkService(s)));
  }

  getLogFiles(logsUrl: string): Observable<LogFile[]> {
    // nginx autoindex JSON returns: [{name, type, mtime, size}, ...]
    return this.http.get<any[]>(logsUrl).pipe(
      map(entries => entries
        .filter((e: any) => e.type === 'file')
        .sort((a: any, b: any) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime())
        .map((e: any) => ({
          name: e.name,
          size: this.formatSize(e.size),
          lastModified: new Date(e.mtime).toLocaleString(),
        }))
      ),
      catchError(() => of([]))
    );
  }

  getLogContent(logsUrl: string, filename: string): Observable<string> {
    return this.http.get(`${logsUrl}${filename}`, { responseType: 'text' }).pipe(
      map(content => {
        // Return last 500 lines for large files
        const lines = content.split('\n');
        if (lines.length > 500) {
          return `... (showing last 500 of ${lines.length} lines)\n\n` + lines.slice(-500).join('\n');
        }
        return content;
      }),
      catchError(err => of(`Error loading log: ${err.message}`))
    );
  }

  getLogDownloadUrl(logsUrl: string, filename: string): string {
    return `${logsUrl}${filename}`;
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private extractDatabases(serviceId: string, body: any): DatabaseStatus[] {
    if (!body) return [];

    if (serviceId === 'agritec-api') {
      const dbs: DatabaseStatus[] = [];
      if (body.entries?.postgresql) {
        const pg = body.entries.postgresql;
        dbs.push({
          name: 'PostgreSQL',
          status: pg.status === 'Healthy' ? 'up' : 'down',
          version: pg.description,
        });
      }
      if (body.status === 'Healthy' && dbs.length === 0) {
        dbs.push({ name: 'PostgreSQL', status: 'up' });
      }
      return dbs;
    }

    if (serviceId === 'ucgagent-api') {
      return [{
        name: 'MSSQL',
        status: body.database?.connected ? 'up' : (body.status === 'healthy' ? 'up' : 'down'),
        server: body.database?.server,
        database: body.database?.name,
        version: body.database?.version,
      }];
    }

    if (serviceId === 'diary-api') {
      const dbs: DatabaseStatus[] = [];
      if (body.couchbase) {
        dbs.push({
          name: 'Couchbase',
          status: body.couchbase.status === 'healthy' ? 'up' : 'down',
          database: body.couchbase.bucket,
        });
      }
      if (body.sqlServer) {
        dbs.push({
          name: 'MSSQL',
          status: body.sqlServer.status === 'healthy' ? 'up' : 'down',
          server: body.sqlServer.server,
          database: body.sqlServer.database,
          version: body.sqlServer.version,
        });
      }
      if (body.diarySqlServer) {
        dbs.push({
          name: 'MSSQL (Diary)',
          status: body.diarySqlServer.status === 'healthy' ? 'up' : 'down',
          server: body.diarySqlServer.server,
          database: body.diarySqlServer.database,
        });
      }
      return dbs;
    }

    return [];
  }
}
