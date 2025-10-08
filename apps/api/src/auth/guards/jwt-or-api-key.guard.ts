import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtOrApiKeyGuard extends AuthGuard('jwt') {
  constructor(private configService: ConfigService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    
    // Check if API key is provided and valid
    if (apiKey) {
      const validApiKey = this.configService.get<string>('API_KEY') || 'development-api-key-change-in-production';
      if (apiKey === validApiKey) {
        // API key is valid, bypass JWT check
        return true;
      }
    }
    
    // Fall back to JWT authentication
    try {
      return (await super.canActivate(context)) as boolean;
    } catch (error) {
      throw new UnauthorizedException('Invalid authentication');
    }
  }
}
