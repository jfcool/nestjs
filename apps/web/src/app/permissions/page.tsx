'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { DataTable } from '@/components/ui/data-table';
import { apiClient } from '@acme/api-types/src/api-client';

// Temporary API wrapper
const api = {
  permissions: {
    roles: {
      list: () => apiClient.get('/permissions/roles'),
      create: (data: any) => apiClient.post('/permissions/roles', data),
      update: (id: string, data: any) => apiClient.put(`/permissions/roles/${id}`, data),
      delete: (id: string) => apiClient.delete(`/permissions/roles/${id}`),
    },
    users: {
      list: () => apiClient.get('/permissions/users'),
      assignRoles: (id: string, data: any) => apiClient.post(`/permissions/users/${id}/roles`, data),
    },
    available: () => apiClient.get('/permissions/available'),
  },
};
import { useTranslation } from '@/lib/i18n';

interface Role {
  id: number;
  name: string;
  description?: string;
  permissions: string[];
  users?: User[];
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: number;
  name: string;
  username?: string;
  email?: string;
  roles: Role[];
}

export default function PermissionsPage() {
  const { t } = useTranslation();
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [newRole, setNewRole] = useState({
    name: '',
    description: '',
    permissions: [] as string[]
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

      const [rolesRes, usersRes, permissionsRes] = await Promise.all([
        api.permissions.roles.list(),
        api.permissions.users.list(),
        api.permissions.available()
      ]);

      setRoles(rolesRes.data);
      setUsers(usersRes.data);
      setAvailablePermissions(permissionsRes.data.permissions || permissionsRes.data);
    } catch (error) {
      console.error('Error fetching permissions data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch permissions data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRole = async () => {
    try {
      await api.permissions.roles.create(newRole);
      toast({
        title: 'Success',
        description: 'Role created successfully',
      });
      setNewRole({ name: '', description: '', permissions: [] });
      setShowCreateRole(false);
      fetchData();
    } catch (error: any) {
      console.error('Error creating role:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create role',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteRole = async (roleId: number) => {
    if (!confirm('Are you sure you want to delete this role?')) return;

    try {
      await api.permissions.roles.delete(roleId.toString());
      toast({
        title: 'Success',
        description: 'Role deleted successfully',
      });
      fetchData();
    } catch (error: any) {
      console.error('Error deleting role:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete role',
        variant: 'destructive',
      });
    }
  };

  const handleAssignRole = async (userId: number, roleIds: number[]) => {
    try {
      await api.permissions.users.assignRoles(userId.toString(), { roleIds });
      toast({
        title: 'Success',
        description: 'Roles assigned successfully',
      });
      fetchData();
    } catch (error: any) {
      console.error('Error assigning roles:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to assign roles',
        variant: 'destructive',
      });
    }
  };

  const togglePermission = (permission: string) => {
    setNewRole(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  if (isLoading) {
    return <div className="p-6">{t('permissions.loadingPermissions')}</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('permissions.title')}</h1>
        <Button onClick={() => setShowCreateRole(true)}>
          {t('permissions.createNewRole')}
        </Button>
      </div>

      {/* Roles Section */}
      <Card>
        <CardHeader>
          <CardTitle>{t('permissions.roles')}</CardTitle>
          <CardDescription>
            {t('permissions.rolesDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {roles.map((role) => (
              <div key={role.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">{role.name}</h3>
                    {role.description && (
                      <p className="text-gray-600 text-sm">{role.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {role.permissions.map((permission) => (
                        <Badge key={permission} variant="secondary">
                          {permission}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {t('permissions.users')}: {role.users?.length || 0}
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteRole(role.id)}
                  >
                    {t('common.delete')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Users Section */}
      <Card>
        <CardHeader>
          <CardTitle>{t('permissions.usersRoleAssignments')}</CardTitle>
          <CardDescription>
            {t('permissions.usersRoleAssignmentsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => (
              <div key={user.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{user.name}</h3>
                    {user.username && (
                      <p className="text-sm text-gray-600">@{user.username}</p>
                    )}
                    {user.email && (
                      <p className="text-sm text-gray-600">{user.email}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {user.roles.map((role) => (
                        <Badge key={role.id} variant="outline">
                          {role.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <select
                    className="border rounded px-3 py-1"
                    onChange={(e) => {
                      const roleId = parseInt(e.target.value);
                      if (roleId) {
                        const currentRoleIds = user.roles.map(r => r.id);
                        if (!currentRoleIds.includes(roleId)) {
                          handleAssignRole(user.id, [...currentRoleIds, roleId]);
                        }
                      }
                    }}
                    value=""
                  >
                    <option value="">{t('permissions.addRole')}</option>
                    {roles
                      .filter(role => !user.roles.some(ur => ur.id === role.id))
                      .map(role => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create Role Modal */}
      {showCreateRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Create New Role</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <Input
                  value={newRole.name}
                  onChange={(e) => setNewRole(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Role name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <Input
                  value={newRole.description}
                  onChange={(e) => setNewRole(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Role description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Permissions</label>
                <div className="space-y-2">
                  {availablePermissions.map((permission) => (
                    <label key={permission} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={newRole.permissions.includes(permission)}
                        onChange={() => togglePermission(permission)}
                      />
                      <span className="text-sm">{permission}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex space-x-2">
                <Button onClick={handleCreateRole} className="flex-1">
                  Create Role
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateRole(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
