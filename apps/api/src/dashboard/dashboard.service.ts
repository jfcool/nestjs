import { Injectable, Inject } from '@nestjs/common';
import { count } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DATABASE_CONNECTION } from '../database/database.module';
import * as schema from '../database/schema';

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async getDashboardStats() {
    // Get real data from database using Drizzle count queries
    const [usersCount] = await this.db.select({ count: count() }).from(schema.users);
    const [conversationsCount] = await this.db.select({ count: count() }).from(schema.conversations);
    const [connectionsCount] = await this.db.select({ count: count() }).from(schema.connections);
    
    const totalUsers = usersCount.count;
    const totalConversations = conversationsCount.count;
    const totalSapConnections = connectionsCount.count;

    // Calculate applications count based on available modules
    const availableApplications = 3; // Dashboard, Users, SAP OData, Chat AI, Permissions

    return {
      totalApplications: availableApplications,
      activeUsers: totalUsers,
      totalConversations,
      totalSapConnections,
      systemStatus: 'Online',
      applications: [
        {
          id: 'users',
          title: 'User Management',
          description: 'Manage user accounts, permissions, and profile information',
          icon: '👥',
          href: '/users',
          color: 'bg-blue-500',
          stats: `${totalUsers} Users`,
        },
        {
          id: 'sapodata',
          title: 'SAP OData Services',
          description: 'Explore, analyze and interact with SAP S/4HANA OData services',
          icon: '🔗',
          href: '/sapodata',
          color: 'bg-green-500',
          stats: totalSapConnections > 0 ? `${totalSapConnections} Connections` : 'Ready to Connect',
        },
        {
          id: 'chat',
          title: 'AI Chat Assistant',
          description: 'Intelligent chat with MCP integration and multiple AI models',
          icon: '💬',
          href: '/chat',
          color: 'bg-purple-500',
          stats: `${totalConversations} Conversations`,
        },
      ],
      recentActivity: [
        {
          id: 'users',
          title: 'User Management',
          description: `${totalUsers} users currently registered`,
          icon: '👥',
          status: 'Active',
        },
        {
          id: 'chat',
          title: 'AI Chat Assistant',
          description: `${totalConversations} conversations in database`,
          icon: '💬',
          status: 'Active',
        },
        {
          id: 'sapodata',
          title: 'SAP OData Services',
          description: totalSapConnections > 0 ? `${totalSapConnections} SAP connections configured` : 'Ready for SAP connections',
          icon: '🔗',
          status: totalSapConnections > 0 ? 'Active' : 'Ready',
        },
      ],
    };
  }
}
