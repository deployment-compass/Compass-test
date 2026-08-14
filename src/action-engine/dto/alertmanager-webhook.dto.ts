export interface AlertmanagerAlert {
  status: 'firing' | 'resolved';
  labels: {
    alertname: string;
    severity?: string;
    service?: string;
    action?: 'GITOPS_HOTFIX' | 'CANARY_ABORT' | 'STORAGE_EXPANSION';
    [key: string]: any;
  };
  annotations: {
    summary?: string;
    description?: string;
  };
  startsAt: string;
  endsAt: string;
}

export interface AlertmanagerPayloadDto {
  version: string;
  groupKey: string;
  status: 'firing' | 'resolved';
  receiver: string;
  alerts: AlertmanagerAlert[];
}
