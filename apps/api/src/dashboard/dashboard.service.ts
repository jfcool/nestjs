import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Conversation } from '../chat/entities/conversation.entity';
import { Connection } from '../sap/entities/sap-connection.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(Connection)
    private sapConnectionRepository: Repository<Connection>,
  ) {}

  async getDashboardStats() {
    // Get real data from database
    const totalUsers = await this.userRepository.count();
    const totalConversations = await this.conversationRepository.count();
    const totalSapConnections = await this.sapConnectionRepository.count();

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
