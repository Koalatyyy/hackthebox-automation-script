export interface Port {
  number: number;
  protocol: 'tcp' | 'udp';
  state: 'open' | 'filtered' | 'closed';
  service: string;
  product?: string;
  version?: string;
  extrainfo?: string;
}

export interface Session {
  target: string;
  machineName: string;
  startTime: string;
  dir: string;
  ports: Port[];
}
