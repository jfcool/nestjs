import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.entity';
import { Role } from './entities/role.entity';

export async function seedAuth(dataSource: DataSource) {
  const userRepository = dataSource.getRepository(User);
  const roleRepository = dataSource.getRepository(Role);

  try {
    // Create or update roles
    let allRole = await roleRepository.findOne({ where: { name: 'all' } });
    if (!allRole) {
      const newAllRole = roleRepository.create({
        name: 'all',
        description: 'Full access to all applications',
        permissions: ['dashboard', 'users', 'sapodata', 'documents', 'chat', 'permissions']
      });
      await roleRepository.save(newAllRole);
      console.log('Created "all" role');
    } else {
      // Update existing role to include documents permission if not present
      const currentPermissions = allRole.permissions || [];
      if (!currentPermissions.includes('documents')) {
        allRole.permissions = [...currentPermissions, 'documents'];
        await roleRepository.save(allRole);
        console.log('Updated "all" role to include documents permission');
      }
    }

    const everestRole = await roleRepository.findOne({ where: { name: 'everest' } });
    if (!everestRole) {
      const newEverestRole = roleRepository.create({
        name: 'everest',
        description: 'Access to Chat AI and SAP OData applications',
        permissions: ['chat', 'sapodata']
      });
      await roleRepository.save(newEverestRole);
      console.log('Created "everest" role');
    }

    // Create admin user if it doesn't exist
    const adminUser = await userRepository.findOne({ where: { username: 'admin' } });
    if (!adminUser) {
      const passwordHash = await bcrypt.hash('admin', 10);
      const allRoleEntity = await roleRepository.findOne({ where: { name: 'all' } });
      
      const newAdminUser = userRepository.create({
        username: 'admin',
        passwordHash,
        name: 'Administrator',
        email: 'admin@example.com',
        roles: allRoleEntity ? [allRoleEntity] : []
      });
      
      await userRepository.save(newAdminUser);
      console.log('Created admin user with username: admin, password: admin');
    }

    // Create everest user if it doesn't exist
    const everestUser = await userRepository.findOne({ where: { username: 'everest' } });
    if (!everestUser) {
      const passwordHash = await bcrypt.hash('everest', 10);
      const everestRoleEntity = await roleRepository.findOne({ where: { name: 'everest' } });
      
      const newEverestUser = userRepository.create({
        username: 'everest',
        passwordHash,
        name: 'Everest User',
        email: 'everest@example.com',
        roles: everestRoleEntity ? [everestRoleEntity] : []
      });
      
      await userRepository.save(newEverestUser);
      console.log('Created everest user with username: everest, password: everest');
    }

    console.log('Auth seeding completed successfully');
  } catch (error) {
    console.error('Error seeding auth data:', error);
    throw error;
  }
}
