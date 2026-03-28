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
          id: 'agritec-api', name: 'Agritec V2 API', type: 'api',
          healthUrl: '/proxy/dev/agritec/health', logsUrl: '/proxy/dev/agritec/health/logs',
          appUrl: 'http://dev.162.19.239.150.nip.io',
          swaggerUrl: 'http://dev.162.19.239.150.nip.io/swagger',
        },
        {
          id: 'ucgagent-api', name: 'UCG Agent API', type: 'api',
          healthUrl: '/proxy/dev/ucgagent/Health/ping', logsUrl: '/proxy/dev/ucgagent/Health/logs',
          appUrl: 'http://ucgagent.162.19.239.150.nip.io',
          swaggerUrl: 'http://ucgagent.162.19.239.150.nip.io/swagger',
        },
        {
          id: 'diary-api', name: 'Diary API', type: 'api',
          healthUrl: '/proxy/dev/diary/api/health', logsUrl: '/proxy/dev/diary/api/health/logs',
          appUrl: 'http://diary.162.19.239.150.nip.io',
          swaggerUrl: 'http://diary.162.19.239.150.nip.io/swagger',
        },
        {
          id: 'agritec-ui', name: 'Agritec V2 UI', type: 'ui',
          healthUrl: '/proxy/dev/agritec-ui/',
          appUrl: 'http://dev.162.19.239.150.nip.io',
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
          id: 'agritec-api', name: 'Agritec V2 API', type: 'api',
          healthUrl: '/proxy/uat/agritec/health', logsUrl: '/proxy/uat/agritec/health/logs',
          appUrl: 'http://uat.162.19.239.150.nip.io',
          swaggerUrl: 'http://uat.162.19.239.150.nip.io/swagger',
        },
        {
          id: 'ucgagent-api', name: 'UCG Agent API', type: 'api',
          healthUrl: '/proxy/uat/ucgagent/Health/ping', logsUrl: '/proxy/uat/ucgagent/Health/logs',
          appUrl: 'http://ucgagent-uat.162.19.239.150.nip.io',
          swaggerUrl: 'http://ucgagent-uat.162.19.239.150.nip.io/swagger',
        },
        {
          id: 'diary-api', name: 'Diary API', type: 'api',
          healthUrl: '/proxy/uat/diary/api/health', logsUrl: '/proxy/uat/diary/api/health/logs',
          appUrl: 'http://diary-uat.162.19.239.150.nip.io',
          swaggerUrl: 'http://diary-uat.162.19.239.150.nip.io/swagger',
        },
        {
          id: 'agritec-ui', name: 'Agritec V2 UI', type: 'ui',
          healthUrl: '/proxy/uat/agritec-ui/',
          appUrl: 'http://uat.162.19.239.150.nip.io',
        },
        {
          id: 'unified-ui', name: 'Unified UI', type: 'ui',
          healthUrl: '/proxy/uat/unified/version',
          appUrl: 'https://uat.agritec.earth',
        },
      ]
    },
    prod: {
      label: 'PROD',
      services: [
        {
          id: 'agritec-api', name: 'Agritec V2 API', type: 'api',
          healthUrl: '/proxy/prod/agritec/health', logsUrl: '/proxy/prod/agritec/health/logs',
          appUrl: 'http://prod.162.19.239.150.nip.io',
          swaggerUrl: 'http://prod.162.19.239.150.nip.io/swagger',
        },
        {
          id: 'ucgagent-api', name: 'UCG Agent API', type: 'api',
          healthUrl: '/proxy/prod/ucgagent/Health/ping', logsUrl: '/proxy/prod/ucgagent/Health/logs',
          appUrl: 'http://ucgagent-prod.162.19.239.150.nip.io',
          swaggerUrl: 'http://ucgagent-prod.162.19.239.150.nip.io/swagger',
        },
        {
          id: 'diary-api', name: 'Diary API', type: 'api',
          healthUrl: '/proxy/prod/diary/api/health', logsUrl: '/proxy/prod/diary/api/health/logs',
          appUrl: 'http://diary-prod.162.19.239.150.nip.io',
          swaggerUrl: 'http://diary-prod.162.19.239.150.nip.io/swagger',
        },
        {
          id: 'agritec-ui', name: 'Agritec V2 UI', type: 'ui',
          healthUrl: '/proxy/prod/agritec-ui/',
          appUrl: 'http://prod.162.19.239.150.nip.io',
        },
        {
          id: 'unified-ui', name: 'Unified UI', type: 'ui',
          healthUrl: '/proxy/prod/unified/version',
          appUrl: 'https://prod.agritec.earth',
        },
      ]
    }
  };

  constructor(private http: HttpClient) {}

  checkService(service: ServiceConfig): Observable<ServiceStatus> {
    const start = Date.now();

    return this.http.get(service.healthUrl, { observe: 'response', responseType: 'json' }).pipe(
      timeout(this.TIMEOUT),
      map(response => {
        const elapsed = Date.now() - start;
        const body: any = response.body;
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
          healthUrl: service.healthUrl,
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
          healthUrl: service.healthUrl,
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
    return this.http.get<LogFile[]>(logsUrl).pipe(
      catchError(() => of([]))
    );
  }

  getLogContent(logsUrl: string, filename: string, lines: number = 200): Observable<string> {
    return this.http.get(`${logsUrl}/${filename}?lines=${lines}`, { responseType: 'text' }).pipe(
      catchError(err => of(`Error loading log: ${err.message}`))
    );
  }

  getLogDownloadUrl(logsUrl: string, filename: string): string {
    return `${logsUrl}/${filename}/download`;
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
