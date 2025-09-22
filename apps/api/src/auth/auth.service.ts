import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.entity';
import { Role } from './entities/role.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { username },
      relations: ['roles'],
    });

    if (user && user.passwordHash && await bcrypt.compare(password, user.passwordHash)) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { 
      username: user.username, 
      sub: user.id,
      roles: user.roles?.map(role => role.name) || [],
      permissions: this.getUserPermissions(user.roles || [])
    };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        roles: user.roles?.map(role => ({
          id: role.id,
          name: role.name,
          permissions: role.permissions
        })) || [],
        permissions: this.getUserPermissions(user.roles || [])
      }
    };
  }

  private getUserPermissions(roles: Role[]): string[] {
    const permissions = new Set<string>();
    roles.forEach(role => {
      role.permissions.forEach(permission => permissions.add(permission));
    });
    return Array.from(permissions);
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  async createUser(userData: {
    username: string;
    password: string;
    name: string;
    email?: string;
    roleIds?: number[];
  }): Promise<User> {
    const passwordHash = await this.hashPassword(userData.password);
    
    const user = this.userRepository.create({
      username: userData.username,
      passwordHash,
      name: userData.name,
      email: userData.email,
    });

    if (userData.roleIds && userData.roleIds.length > 0) {
      const roles = await this.roleRepository.findByIds(userData.roleIds);
      user.roles = roles;
    }

    return this.userRepository.save(user);
  }

  async findUserById(id: number): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      relations: ['roles'],
    });
  }

  async findUserByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { username },
      relations: ['roles'],
    });
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('User not found or no password set');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password and update
    const newPasswordHash = await this.hashPassword(newPassword);
    await this.userRepository.update(userId, { passwordHash: newPasswordHash });

    return { message: 'Password changed successfully' };
  }
}
