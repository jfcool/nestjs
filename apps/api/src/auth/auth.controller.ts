import { Controller, Request, Post, UseGuards, Body, Get } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @Post('register')
  async register(@Body() body: {
    username: string;
    password: string;
    name: string;
    email?: string;
    roleIds?: number[];
  }) {
    const user = await this.authService.createUser(body);
    const { passwordHash, ...result } = user;
    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getMe(@Request() req) {
    const user = await this.authService.findUserById(req.user.id);
    if (user) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('change-password')
  async changePassword(@Request() req, @Body() body: {
    currentPassword: string;
    newPassword: string;
  }) {
    return this.authService.changePassword(req.user.id, body.currentPassword, body.newPassword);
  }
}
