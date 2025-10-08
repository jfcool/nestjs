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

  async getDashboardStats(userPermissions: string[] = []) {
    // Get real data from database using Drizzle count queries
    const [usersCount] = await this.db.select({ count: count() }).from(schema.users);
    const [conversationsCount] = await this.db.select({ count: count() }).from(schema.conversations);
    const [connectionsCount] = await this.db.select({ count: count() }).from(schema.connections);
    
    const totalUsers = usersCount.count;
    const totalConversations = conversationsCount.count;
    const totalSapConnections = connectionsCount.count;

    // Define all possible applications
    const allApplications = [
      {
        id: 'users',
        permission: 'users',
        title: 'User Management',
        description: 'Manage user accounts, permissions, and profile information',
        icon: '👥',
        href: '/users',
        color: 'bg-blue-500',
        stats: `${totalUsers} Users`,
      },
      {
        id: 'documents',
        permission: 'documents',
        title: 'Document Management',
        description: 'Upload, search and manage documents with AI-powered search',
        icon: '📄',
        href: '/documents',
        color: 'bg-indigo-500',
        stats: 'Document Library',
      },
      {
        id: 'sapodata',
        permission: 'sapodata',
        title: 'SAP OData Services',
        description: 'Explore, analyze and interact with SAP S/4HANA OData services',
        icon: '🔗',
        href: '/sapodata',
        color: 'bg-green-500',
        stats: totalSapConnections > 0 ? `${totalSapConnections} Connections` : 'Ready to Connect',
      },
      {
        id: 'chat',
        permission: 'chat',
        title: 'AI Chat Assistant',
        description: 'Intelligent chat with MCP integration and multiple AI models',
        icon: '💬',
        href: '/chat',
        color: 'bg-purple-500',
        stats: `${totalConversations} Conversations`,
      },
      {
        id: 'permissions',
        permission: 'permissions',
        title: 'Permissions Management',
        description: 'Manage roles, permissions and user access control',
        icon: '🔐',
        href: '/permissions',
        color: 'bg-red-500',
        stats: 'Role Management',
      },
    ];

    // Filter applications based on user permissions
    const availableApplications = allApplications.filter(app => 
      userPermissions.includes(app.permission)
    );

    return {
      totalApplications: availableApplications.length,
      activeUsers: totalUsers,
      totalConversations,
      totalSapConnections,
      systemStatus: 'Online',
      applications: availableApplications,
      recentActivity: availableApplications.slice(0, 3).map(app => ({
        id: app.id,
        title: app.title,
        description: app.stats,
        icon: app.icon,
        status: 'Active',
      })),
    };
  }
}
