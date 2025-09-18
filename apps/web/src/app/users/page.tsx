'use client';

import React, { useState, useMemo } from 'react';
import { ColDef } from 'ag-grid-community';
import {
  User,
  Mail,
  Plus,
  Search,
  Edit,
  Trash2,
  Users,
  CheckCircle,
  AlertCircle,
  Zap,
  RefreshCw,
} from 'lucide-react';
import type { UserDto } from '@acme/api-types';
import { useGetUsers, useDeleteUserCustom, getGetUsersQueryKey } from '@acme/api-types';
import CreateUserModal from './CreateUserModal';
import EditUserModal from './EditUserModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DataTable } from '@/components/ui/data-table';
import { useToast } from '@/hooks/use-toast';

export default function UsersPage() {
  const { data, isLoading, isError } = useGetUsers();
  const users = (data?.data as UserDto[]) ?? [];
  const [searchText, setSearchText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserDto | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserDto | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteUserMutation = useDeleteUserCustom({
    mutation: {
      onSuccess: () => {
        toast({
          title: "Erfolg",
          description: "Benutzer erfolgreich gelöscht!",
        });
        queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
      },
      onError: (error: any) => {
        console.error('Error deleting user:', error);
        toast({
          title: "Fehler",
          description: "Fehler beim Löschen des Benutzers. Bitte versuchen Sie es erneut.",
          variant: "destructive",
        });
      },
    },
  });

  const handleEditUser = (user: UserDto) => {
    setSelectedUser(user);
    setEditModalVisible(true);
  };

  const handleDeleteUser = (user: UserDto) => {
    setUserToDelete(user);
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = () => {
    if (userToDelete) {
      deleteUserMutation.mutate({ id: userToDelete.id });
      setDeleteModalVisible(false);
      setUserToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteModalVisible(false);
    setUserToDelete(null);
  };

  // Filter users based on search text
  const filteredUsers = useMemo(() => {
    if (!searchText) {
      return users;
    }
    
    const searchWords = searchText.toLowerCase().trim().split(/\s+/).filter(word => word.length > 0);
    
    return users.filter((user) => {
      const searchableText = [
        user.name,
        user.email || '',
        user.id.toString(),
      ].join(' ').toLowerCase();
      
      return searchWords.every(word => searchableText.includes(word));
    });
  }, [searchText, users]);

  // Calculate statistics
  const stats = useMemo(() => ({
    total: users.length,
    withEmail: users.filter(u => u.email).length,
    withoutEmail: users.filter(u => !u.email).length,
    recentlyCreated: users.filter(u => u.id > Math.max(0, Math.max(...users.map(u => u.id)) - 2)).length,
  }), [users]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // AG Grid column definitions
  const columnDefs: ColDef[] = useMemo(() => [
    {
      headerName: 'Benutzer Information',
      field: 'name',
      width: 250,
      cellRenderer: (params: any) => {
        const user = params.data;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium text-primary text-sm">
                {user.name}
              </div>
              <div className="text-xs text-muted-foreground">
                Benutzer #{user.id}
              </div>
            </div>
          </div>
        );
      },
      comparator: (valueA, valueB) => valueA.localeCompare(valueB),
    },
    {
      headerName: 'E-Mail',
      field: 'email',
      width: 200,
      cellRenderer: (params: any) => {
        const user = params.data;
        return (
          <div className="flex items-center gap-2">
            {user.email ? (
              <>
                <Mail className="h-4 w-4 text-green-500" />
                <span className="text-sm">{user.email}</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-muted-foreground">Keine E-Mail</span>
              </>
            )}
          </div>
        );
      },
      comparator: (valueA, valueB) => (valueA || '').localeCompare(valueB || ''),
    },
    {
      headerName: 'ID',
      field: 'id',
      width: 80,
      cellRenderer: (params: any) => (
        <Badge variant="secondary" className="text-xs">
          #{params.value}
        </Badge>
      ),
      comparator: (valueA, valueB) => valueA - valueB,
    },
    {
      headerName: 'Status',
      field: 'email',
      width: 120,
      cellRenderer: (params: any) => {
        const hasEmail = !!params.data.email;
        return (
          <Badge variant={hasEmail ? 'default' : 'secondary'} className="text-xs gap-1">
            {hasEmail ? (
              <>
                <CheckCircle className="h-3 w-3" />
                Vollständig
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3" />
                Unvollständig
              </>
            )}
          </Badge>
        );
      },
      comparator: (valueA, valueB) => (!!valueA ? 1 : 0) - (!!valueB ? 1 : 0),
    },
    {
      headerName: 'Aktionen',
      width: 120,
      sortable: false,
      filter: false,
      cellRenderer: (params: any) => {
        const user = params.data;
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEditUser(user)}
              className="h-8 w-8 p-0"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteUser(user)}
              disabled={deleteUserMutation.isPending}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ], [deleteUserMutation.isPending]);

  if (isError) {
    return (
      <div className="min-h-screen bg-gray-50 p-5">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="text-center py-16">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-xl font-semibold text-destructive mb-2">
              Verbindungsfehler
            </h3>
            <p className="text-muted-foreground mb-6">
              Fehler beim Laden der Benutzerliste. Bitte versuchen Sie es erneut.
            </p>
            <Button onClick={() => window.location.reload()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Erneut versuchen
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-none mx-auto p-2 sm:p-4 lg:p-6">
      {/* Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="text-center lg:text-left">
              <CardTitle className="text-2xl text-primary flex items-center justify-center lg:justify-start gap-2">
                🔗 Benutzerverwaltung
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Verwalten Sie Benutzerkonten und deren Informationen
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => setModalVisible(true)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Benutzer hinzufügen
              </Button>
              <div className="text-xs text-muted-foreground text-center sm:text-right">
                <div>System bereit</div>
                <div>{users.length} Benutzer geladen</div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="text-center p-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Gesamt Benutzer</span>
            </div>
            <div className="text-2xl font-bold text-primary">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center p-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Mail className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium">Mit E-Mail</span>
            </div>
            <div className="text-2xl font-bold text-green-500">{stats.withEmail}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center p-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <span className="text-sm font-medium">Ohne E-Mail</span>
            </div>
            <div className="text-2xl font-bold text-amber-500">{stats.withoutEmail}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center p-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Zap className="h-5 w-5 text-purple-500" />
              <span className="text-sm font-medium">Kürzlich erstellt</span>
            </div>
            <div className="text-2xl font-bold text-purple-500">
              {stats.recentlyCreated}
              <span className="text-sm text-muted-foreground">/{stats.total}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">
                Benutzer suchen:
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Benutzer suchen..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Zeige {filteredUsers.length} von {users.length} Benutzern
              {searchText && ` (gefiltert nach "${searchText}")`}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          {!isLoading && filteredUsers.length === 0 && !searchText ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-6">🚀</div>
              <h3 className="text-xl font-semibold text-primary mb-4">
                Willkommen zur Benutzerverwaltung
              </h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Erstellen Sie Ihren ersten Benutzer, um loszulegen.
              </p>
              <Button
                onClick={() => setModalVisible(true)}
                size="lg"
                className="gap-2"
              >
                <Plus className="h-5 w-5" />
                Ersten Benutzer erstellen
              </Button>
            </div>
          ) : (
            <DataTable
              data={filteredUsers}
              columns={columnDefs}
              loading={isLoading}
              pagination={true}
              paginationPageSize={50}
              height={600}
            />
          )}
        </CardContent>
      </Card>

      {/* Create User Modal */}
      <CreateUserModal 
        visible={modalVisible} 
        onClose={() => setModalVisible(false)} 
      />

      {/* Edit User Modal */}
      <EditUserModal
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
      />

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        open={deleteModalVisible}
        user={userToDelete}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        loading={deleteUserMutation.isPending}
      />
    </div>
  );
}
