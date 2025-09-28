import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('test-auth')
  @UseGuards(AuthGuard('jwt'))
  testAuth(@Request() req: any) {
    return {
      message: 'Authentication successful',
      user: req.user,
      timestamp: new Date().toISOString()
    };
  }
}
