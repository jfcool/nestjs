'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const applications = [
  {
    id: 'users',
    title: 'User Management',
    description: 'Manage user accounts, permissions, and profile information',
    icon: '👥',
    href: '/users',
    color: 'bg-blue-500',
    stats: '8 Users',
  },
  {
    id: 'sapodata',
    title: 'SAP OData Services',
    description: 'Explore, analyze and interact with SAP S/4HANA OData services',
    icon: '🔗',
    href: '/sapodata',
    color: 'bg-green-500',
    stats: 'Ready to Connect',
  },
  {
    id: 'chat',
    title: 'AI Chat Assistant',
    description: 'Intelligent chat with MCP integration and multiple AI models',
    icon: '💬',
    href: '/chat',
    color: 'bg-purple-500',
    stats: '50 Conversations',
  },
];

export default function DashboardPage() {
  return (
    <div className="w-full max-w-none mx-auto p-2 sm:p-4 lg:p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <span className="text-2xl">🏠</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">Welcome to Joe's Playground - Your central hub for all applications</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Applications</p>
                <p className="text-2xl font-bold text-gray-900">{applications.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">📱</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-2xl font-bold text-gray-900">8</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">👤</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">System Status</p>
                <p className="text-2xl font-bold text-green-600">Online</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">✅</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Applications Grid */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Applications</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {applications.map((app) => (
            <Link key={app.id} href={app.href} className="group">
              <Card className="h-full transition-all duration-200 hover:shadow-lg hover:scale-105 cursor-pointer border-2 hover:border-blue-300">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-14 h-14 ${app.color} rounded-xl flex items-center justify-center text-white shadow-lg`}>
                      <span className="text-2xl">{app.icon}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        {app.stats}
                      </span>
                    </div>
                  </div>
                  <CardTitle className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {app.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-gray-600 text-sm leading-relaxed mb-4">
                    {app.description}
                  </p>
                  <div className="flex items-center text-blue-600 text-sm font-medium group-hover:text-blue-700">
                    <span>Open Application</span>
                    <svg className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm">👥</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">User Management</p>
                <p className="text-xs text-gray-500">8 users currently registered</p>
              </div>
              <span className="text-xs text-gray-400">Active</span>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm">💬</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">AI Chat Assistant</p>
                <p className="text-xs text-gray-500">50 conversations in database</p>
              </div>
              <span className="text-xs text-gray-400">Active</span>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm">🔗</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">SAP OData Services</p>
                <p className="text-xs text-gray-500">Ready for SAP connections</p>
              </div>
              <span className="text-xs text-gray-400">Ready</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
