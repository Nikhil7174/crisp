// src/services/securityService.ts
import WebSocket from 'ws';

export interface SecurityAgentStatus {
  connected: boolean;
  active: boolean;
  error?: string;
  timestamp: number;
}

export class SecurityService {
  private static instance: SecurityService;
  private securityAgentPort: number;
  private connectionTimeout: number;

  constructor() {
    this.securityAgentPort = 8765;
    this.connectionTimeout = 5000; // 5 seconds
  }

  public static getInstance(): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService();
    }
    return SecurityService.instance;
  }

  /**
   * Check if the security agent is running and responsive
   */
  public async checkSecurityAgentConnection(): Promise<SecurityAgentStatus> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      try {
        const ws = new WebSocket(`ws://localhost:${this.securityAgentPort}`);

        const timeout = setTimeout(() => {
          ws.close();
          resolve({
            connected: false,
            active: false,
            error: 'Connection timeout',
            timestamp: Date.now()
          });
        }, this.connectionTimeout);

        ws.on('open', () => {
          clearTimeout(timeout);
          
          // Send a ping message
          ws.send(JSON.stringify({ type: 'ping' }));
          
          // Set up response handler
          const responseTimeout = setTimeout(() => {
            ws.close();
            resolve({
              connected: true,
              active: false,
              error: 'Agent not responsive',
              timestamp: Date.now()
            });
          }, 2000);

          ws.on('message', (data: WebSocket.Data) => {
            try {
              const message = JSON.parse(data.toString());
              if (message.type === 'pong' || message.type === 'handshake') {
                clearTimeout(responseTimeout);
                ws.close();
                resolve({
                  connected: true,
                  active: true,
                  timestamp: Date.now()
                });
              }
            } catch (error) {
              clearTimeout(responseTimeout);
              ws.close();
              resolve({
                connected: true,
                active: false,
                error: 'Invalid response from agent',
                timestamp: Date.now()
              });
            }
          });

          ws.on('error', (error: Error) => {
            clearTimeout(responseTimeout);
            ws.close();
            resolve({
              connected: false,
              active: false,
              error: error.message,
              timestamp: Date.now()
            });
          });
        });

        ws.on('error', (error: Error) => {
          clearTimeout(timeout);
          resolve({
            connected: false,
            active: false,
            error: error.message,
            timestamp: Date.now()
          });
        });

        ws.on('close', () => {
          clearTimeout(timeout);
          // Only resolve if we haven't already resolved
          if (Date.now() - startTime < this.connectionTimeout) {
            resolve({
              connected: false,
              active: false,
              error: 'Connection closed',
              timestamp: Date.now()
            });
          }
        });

      } catch (error) {
        resolve({
          connected: false,
          active: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now()
        });
      }
    });
  }

  /**
   * Get security agent status with caching to avoid too many connection attempts
   */
  private lastCheckTime: number = 0;
  private lastStatus: SecurityAgentStatus | null = null;
  private cacheTimeout: number = 10000; // 10 seconds cache

  public async getSecurityAgentStatus(): Promise<SecurityAgentStatus> {
    const now = Date.now();
    
    // Return cached result if it's still fresh
    if (this.lastStatus && (now - this.lastCheckTime) < this.cacheTimeout) {
      return this.lastStatus;
    }

    // Perform new check
    const status = await this.checkSecurityAgentConnection();
    this.lastStatus = status;
    this.lastCheckTime = now;
    
    return status;
  }
}
