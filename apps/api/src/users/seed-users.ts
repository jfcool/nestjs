import { DataSource } from 'typeorm';
import { User } from './user.entity';

export async function seedUsers(dataSource: DataSource) {
  const userRepository = dataSource.getRepository(User);
  
  // Check if users already exist
  const existingUsers = await userRepository.count();
  if (existingUsers > 0) {
    console.log('Users already exist, skipping seed');
    return;
  }

  const users = [
    { name: 'Max Mustermann', email: 'max@example.com' },
    { name: 'Erika Musterfrau', email: 'erika@example.com' },
    { name: 'Fränki', email: null },
    { name: 'Anna Schmidt', email: 'anna.schmidt@test.de' },
    { name: 'Peter Müller', email: 'peter.mueller@example.org' },
  ];

  for (const userData of users) {
    const user = userRepository.create(userData);
    await userRepository.save(user);
    console.log(`Created user: ${user.name}`);
  }

  console.log('User seeding completed');
}
