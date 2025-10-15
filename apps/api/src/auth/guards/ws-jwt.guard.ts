import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

/**
 * WebSocket JWT Authentication Guard
 * Validates JWT tokens from WebSocket connections
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    
    try {
      const token = this.extractTokenFromHandshake(client);

      if (!token) {
        this.logger.error('WebSocket authentication failed: No authentication token provided');
        client.disconnect();
        return false;
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });

      // Attach user to socket for later use
      client.data.user = payload;
      
      this.logger.debug(`WebSocket authenticated: User ${payload.sub} (${payload.username})`);
      
      return true;
    } catch (error) {
      this.logger.error(`WebSocket authentication failed: ${error.message}`);
      client.disconnect();
      return false;
    }
  }

  private extractTokenFromHandshake(client: Socket): string | undefined {
    // Try to get token from auth header
    const authHeader = client.handshake.headers.authorization;
    if (authHeader) {
      const [type, token] = authHeader.split(' ');
      return type === 'Bearer' ? token : undefined;
    }

    // Fallback: Try to get token from query parameters
    const token = client.handshake.auth?.token || client.handshake.query?.token;
    return Array.isArray(token) ? token[0] : token;
  }
}
