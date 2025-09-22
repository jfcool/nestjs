import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Role } from '../auth/entities/role.entity';
import { User } from '../users/user.entity';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  // Available permissions in the system
  private readonly availablePermissions = [
    'dashboard',
    'users',
    'sapodata',
    'chat',
    'permissions'
  ];

  async getAllRoles(): Promise<Role[]> {
    return this.roleRepository.find({
      relations: ['users'],
    });
  }

  async getRoleById(id: number): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: { id },
      relations: ['users'],
    });
    
    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }
    
    return role;
  }

  async createRole(roleData: {
    name: string;
    description?: string;
    permissions: string[];
  }): Promise<Role> {
    // Validate permissions
    const invalidPermissions = roleData.permissions.filter(
      permission => !this.availablePermissions.includes(permission)
    );
    
    if (invalidPermissions.length > 0) {
      throw new BadRequestException(`Invalid permissions: ${invalidPermissions.join(', ')}`);
    }

    // Check if role name already exists
    const existingRole = await this.roleRepository.findOne({
      where: { name: roleData.name }
    });
    
    if (existingRole) {
      throw new BadRequestException(`Role with name '${roleData.name}' already exists`);
    }

    const role = this.roleRepository.create(roleData);
    return this.roleRepository.save(role);
  }

  async updateRole(id: number, roleData: {
    name?: string;
    description?: string;
    permissions?: string[];
  }): Promise<Role> {
    const role = await this.getRoleById(id);

    if (roleData.permissions) {
      // Validate permissions
      const invalidPermissions = roleData.permissions.filter(
        permission => !this.availablePermissions.includes(permission)
      );
      
      if (invalidPermissions.length > 0) {
        throw new BadRequestException(`Invalid permissions: ${invalidPermissions.join(', ')}`);
      }
    }

    if (roleData.name && roleData.name !== role.name) {
      // Check if new name already exists
      const existingRole = await this.roleRepository.findOne({
        where: { name: roleData.name }
      });
      
      if (existingRole) {
        throw new BadRequestException(`Role with name '${roleData.name}' already exists`);
      }
    }

    Object.assign(role, roleData);
    return this.roleRepository.save(role);
  }

  async deleteRole(id: number): Promise<void> {
    const role = await this.getRoleById(id);
    await this.roleRepository.remove(role);
  }

  async assignRolesToUser(userId: number, roleIds: number[]): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });
    
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Validate that all role IDs exist
    const roles = await this.roleRepository.findBy({
      id: In(roleIds)
    });
    
    if (roles.length !== roleIds.length) {
      const foundIds = roles.map(role => role.id);
      const missingIds = roleIds.filter(id => !foundIds.includes(id));
      throw new BadRequestException(`Roles not found: ${missingIds.join(', ')}`);
    }

    user.roles = roles;
    return this.userRepository.save(user);
  }

  async removeRoleFromUser(userId: number, roleId: number): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles'],
    });
    
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    user.roles = user.roles.filter(role => role.id !== roleId);
    return this.userRepository.save(user);
  }

  async getUsersWithRoles(): Promise<User[]> {
    return this.userRepository.find({
      relations: ['roles'],
    });
  }

  getAvailablePermissions(): string[] {
    return [...this.availablePermissions];
  }
}
