'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiClient, ApiError, NetworkError } from '@/lib/api-client';

interface Connection {
  id: string;
  name: string;
  type: 'sap' | 'agentdb';
  description?: string;
  parameters: Record<string, any>;
  cacheConnectionId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

interface CreateConnectionForm {
  name: string;
  type: 'sap' | 'agentdb';
  description?: string;
  parameters: Record<string, any>;
  cacheConnectionId?: string;
}

const SAP_PARAMETER_FIELDS = [
  { key: 'baseUrl', label: 'Base URL', type: 'text', required: true, placeholder: 'https://your-sap-system:44301' },
  { key: 'basePath', label: 'Base Path', type: 'text', required: false, placeholder: 'Optional base path' },
  { key: 'username', label: 'Username', type: 'text', required: true, placeholder: 'SAP Username' },
  { key: 'password', label: 'Password', type: 'password', required: true, placeholder: 'SAP Password' },
  { key: 'timeout', label: 'Timeout (ms)', type: 'number', required: false, placeholder: '30000' },
  { key: 'rejectUnauthorized', label: 'Validate SSL Certificates', type: 'checkbox', required: false },
  { key: 'userAgent', label: 'User Agent', type: 'text', required: false, placeholder: 'NestJS-SAP-OData-Client' },
];

const AGENTDB_PARAMETER_FIELDS = [
  { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'AgentDB API Key' },
  { key: 'token', label: 'Token', type: 'text', required: true, placeholder: 'UUID token for database access' },
  { key: 'database', label: 'Database', type: 'text', required: true, placeholder: 'Database name' },
  { key: 'baseUrl', label: 'Base URL', type: 'text', required: false, placeholder: 'https://api.agentdb.dev' },
];

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [formData, setFormData] = useState<CreateConnectionForm>({
    name: '',
    type: 'sap',
    description: '',
    parameters: {
      baseUrl: '',
      username: '',
      password: '',
      timeout: 30000,
      rejectUnauthorized: false,
      userAgent: 'NestJS-SAP-OData-Client',
    },
    cacheConnectionId: undefined
  });
  const { toast } = useToast();

  // Load connections on component mount
  useEffect(() => {
    loadConnections();
  }, []);

  // Reset parameters when connection type changes
  useEffect(() => {
    if (formData.type === 'sap') {
      setFormData(prev => ({
        ...prev,
        parameters: {
          baseUrl: '',
          username: '',
          password: '',
          timeout: 30000,
          rejectUnauthorized: false,
          userAgent: 'NestJS-SAP-OData-Client',
        }
      }));
    } else if (formData.type === 'agentdb') {
      setFormData(prev => ({
        ...prev,
        parameters: {
          apiKey: '',
          database: '',
          baseUrl: '',
        }
      }));
    }
  }, [formData.type]);

  const loadConnections = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/sap/connections');
      setConnections(response.data);
    } catch (error) {
      console.error('Error loading connections:', error);
      const errorMessage = error instanceof ApiError 
        ? `API Error: ${error.message}` 
        : error instanceof NetworkError 
        ? `Network Error: ${error.message}`
        : 'Failed to load connections';
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createConnection = async () => {
    try {
      setLoading(true);
      
      const response = await apiClient.post('/sap/connections', formData);
      const newConnection = response.data;
      setConnections(prev => [newConnection, ...prev]);
      setShowCreateDialog(false);
      
      // Reset form
      setFormData({
        name: '',
        type: 'sap',
        description: '',
        parameters: {
          baseUrl: '',
          username: '',
          password: '',
          timeout: 30000,
          rejectUnauthorized: false,
          userAgent: 'NestJS-SAP-OData-Client',
        },
        cacheConnectionId: undefined
      });

      toast({
        title: 'Success',
        description: 'Connection created successfully',
      });
    } catch (error) {
      console.error('Error creating connection:', error);
      const errorMessage = error instanceof ApiError 
        ? `API Error: ${error.message}` 
        : error instanceof NetworkError 
        ? `Network Error: ${error.message}`
        : 'Failed to create connection';
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (connectionId: string) => {
    try {
      setLoading(true);
      
      const response = await apiClient.post(`/sap/connections/${connectionId}/test`, {});
      const result = response.data;
      
      toast({
        title: result.success ? 'Success' : 'Error',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
    } catch (error) {
      console.error('Error testing connection:', error);
      const errorMessage = error instanceof ApiError 
        ? `API Error: ${error.message}` 
        : error instanceof NetworkError 
        ? `Network Error: ${error.message}`
        : 'Failed to test connection';
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const editConnection = (connection: Connection) => {
    setEditingConnection(connection);
    setFormData({
      name: connection.name,
      type: connection.type,
      description: connection.description || '',
      parameters: { ...connection.parameters },
      cacheConnectionId: connection.cacheConnectionId
    });
    setShowEditDialog(true);
  };

  const updateConnection = async () => {
    if (!editingConnection) return;

    try {
      setLoading(true);
      
      const response = await apiClient.put(`/sap/connections/${editingConnection.id}`, formData);
      const updatedConnection = response.data;
      setConnections(prev => prev.map(conn => 
        conn.id === editingConnection.id ? updatedConnection : conn
      ));
      setShowEditDialog(false);
      setEditingConnection(null);
      
      // Reset form
      setFormData({
        name: '',
        type: 'sap',
        description: '',
        parameters: {
          baseUrl: '',
          username: '',
          password: '',
          timeout: 30000,
          rejectUnauthorized: false,
          userAgent: 'NestJS-SAP-OData-Client',
        },
        cacheConnectionId: undefined
      });

      toast({
        title: 'Success',
        description: 'Connection updated successfully',
      });
    } catch (error) {
      console.error('Error updating connection:', error);
      const errorMessage = error instanceof ApiError 
        ? `API Error: ${error.message}` 
        : error instanceof NetworkError 
        ? `Network Error: ${error.message}`
        : 'Failed to update connection';
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteConnection = async (connectionId: string) => {
    if (!confirm('Are you sure you want to delete this connection?')) {
      return;
    }

    try {
      setLoading(true);
      
      await apiClient.delete(`/sap/connections/${connectionId}`);
      setConnections(prev => prev.filter(conn => conn.id !== connectionId));
      
      toast({
        title: 'Success',
        description: 'Connection deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting connection:', error);
      const errorMessage = error instanceof ApiError 
        ? `API Error: ${error.message}` 
        : error instanceof NetworkError 
        ? `Network Error: ${error.message}`
        : 'Failed to delete connection';
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const updateParameter = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [key]: value
      }
    }));
  };

  const renderParameterField = (field: any) => {
    const value = formData.parameters[field.key] || '';
    
    if (field.type === 'checkbox') {
      return (
        <div key={field.key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            id={field.key}
            checked={!!value}
            onChange={(e) => updateParameter(field.key, e.target.checked)}
          />
          <label htmlFor={field.key} style={{ fontSize: '14px' }}>
            {field.label}
          </label>
        </div>
      );
    }

    return (
      <div key={field.key}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
          {field.label} {field.required && '*'}
        </label>
        <Input
          type={field.type}
          placeholder={field.placeholder}
          value={field.type === 'number' ? (value || '') : value}
          onChange={(e) => {
            const newValue = field.type === 'number' 
              ? (e.target.value ? parseInt(e.target.value) : undefined)
              : e.target.value;
            updateParameter(field.key, newValue);
          }}
        />
      </div>
    );
  };

  const getParameterFields = () => {
    return formData.type === 'sap' ? SAP_PARAMETER_FIELDS : AGENTDB_PARAMETER_FIELDS;
  };

  const isFormValid = () => {
    if (!formData.name) return false;
    
    const fields = getParameterFields();
    return fields.every(field => {
      if (!field.required) return true;
      const value = formData.parameters[field.key];
      return value !== undefined && value !== '' && value !== null;
    });
  };

  const getCacheConnections = () => {
    return connections.filter(conn => conn.type === 'agentdb' && conn.isActive);
  };

  const getCacheConnectionName = (cacheConnectionId?: string) => {
    if (!cacheConnectionId) return undefined;
    const cacheConn = connections.find(conn => conn.id === cacheConnectionId);
    return cacheConn?.name;
  };

  const renderConnectionDetails = (connection: Connection) => {
    const params = connection.parameters;
    const details = [];

    if (connection.type === 'sap') {
      if (params.baseUrl) details.push(`🌐 ${params.baseUrl}`);
      if (params.username) details.push(`👤 ${params.username}`);
      if (params.timeout) details.push(`⏱️ ${params.timeout}ms`);
    } else if (connection.type === 'agentdb') {
      if (params.database) details.push(`🗄️ ${params.database}`);
      if (params.baseUrl) details.push(`🌐 ${params.baseUrl}`);
    }

    return details;
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#1e3a8a', color: 'white', padding: '24px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0 0 8px 0' }}>
          Connection Management
        </h1>
        <p style={{ color: '#bfdbfe', margin: 0 }}>
          Manage your system connections with flexible parameter configuration
        </p>
      </div>

      <div style={{ width: '100%', maxWidth: 'none', margin: '0 auto', padding: '12px 16px' }} className="sm:px-6 lg:px-8">
        {/* Actions */}
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>
            Connections ({connections.length})
          </h2>
          
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                ➕ Create Connection
              </Button>
            </DialogTrigger>
            <DialogContent style={{ maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
              <DialogHeader>
                <DialogTitle>Create New Connection</DialogTitle>
              </DialogHeader>
              
              <div style={{ display: 'grid', gap: '16px', marginTop: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                    Connection Name *
                  </label>
                  <Input
                    placeholder="e.g., SAP Production, AgentDB Cache"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                    Connection Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'sap' | 'agentdb' }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="sap">SAP System</option>
                    <option value="agentdb">AgentDB Cache</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                    Description
                  </label>
                  <Input
                    placeholder="Optional description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                {/* Dynamic Parameter Fields */}
                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
                    {formData.type === 'sap' ? 'SAP Connection Parameters' : 'AgentDB Parameters'}
                  </h3>
                  <div style={{ display: 'grid', gap: '16px' }}>
                    {getParameterFields().map(renderParameterField)}
                  </div>
                </div>

                {/* Cache Connection (only for SAP) */}
                {formData.type === 'sap' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                      Cache Connection
                    </label>
                    <select
                      value={formData.cacheConnectionId || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, cacheConnectionId: e.target.value || undefined }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    >
                      <option value="">No Caching</option>
                      {getCacheConnections().map(conn => (
                        <option key={conn.id} value={conn.id}>{conn.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateDialog(false)}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={createConnection}
                    disabled={loading || !isFormValid()}
                  >
                    {loading ? 'Creating...' : 'Create Connection'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit Connection Dialog */}
          <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogContent style={{ maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
              <DialogHeader>
                <DialogTitle>Edit Connection</DialogTitle>
              </DialogHeader>
              
              <div style={{ display: 'grid', gap: '16px', marginTop: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                    Connection Name *
                  </label>
                  <Input
                    placeholder="e.g., SAP Production, AgentDB Cache"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                    Connection Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'sap' | 'agentdb' }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                    disabled={true} // Disable type change when editing
                  >
                    <option value="sap">SAP System</option>
                    <option value="agentdb">AgentDB Cache</option>
                  </select>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    Connection type cannot be changed when editing
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                    Description
                  </label>
                  <Input
                    placeholder="Optional description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                {/* Dynamic Parameter Fields */}
                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
                    {formData.type === 'sap' ? 'SAP Connection Parameters' : 'AgentDB Parameters'}
                  </h3>
                  <div style={{ display: 'grid', gap: '16px' }}>
                    {getParameterFields().map(renderParameterField)}
                  </div>
                </div>

                {/* Cache Connection (only for SAP) */}
                {formData.type === 'sap' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                      Cache Connection
                    </label>
                    <select
                      value={formData.cacheConnectionId || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, cacheConnectionId: e.target.value || undefined }))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    >
                      <option value="">No Caching</option>
                      {getCacheConnections().map(conn => (
                        <option key={conn.id} value={conn.id}>{conn.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowEditDialog(false);
                      setEditingConnection(null);
                    }}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={updateConnection}
                    disabled={loading || !isFormValid()}
                  >
                    {loading ? 'Updating...' : 'Update Connection'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Connections List */}
        {loading && connections.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px' }}>
            <div style={{ fontSize: '24px', marginBottom: '16px' }}>⏳</div>
            <p>Loading connections...</p>
          </div>
        ) : connections.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔗</div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '8px' }}>
              No connections configured
            </h3>
            <p style={{ color: '#6b7280' }}>
              Create your first connection to get started.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {connections.map((connection) => (
              <Card key={connection.id} style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: '600', margin: 0 }}>
                        {connection.name}
                      </h3>
                      <Badge variant={connection.type === 'sap' ? 'default' : 'secondary'}>
                        {connection.type.toUpperCase()}
                      </Badge>
                      <Badge variant={connection.isActive ? 'default' : 'secondary'}>
                        {connection.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      {connection.cacheConnectionId && (
                        <Badge variant="outline">
                          🗄️ {getCacheConnectionName(connection.cacheConnectionId)}
                        </Badge>
                      )}
                    </div>
                    
                    {connection.description && (
                      <p style={{ color: '#374151', fontSize: '14px', margin: '0 0 8px 0' }}>
                        {connection.description}
                      </p>
                    )}
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                      {renderConnectionDetails(connection).map((detail, index) => (
                        <span key={index}>{detail}</span>
                      ))}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#6b7280' }}>
                      <span>📅 Created {formatDate(connection.createdAt)}</span>
                      {connection.createdBy && <span>👨‍💻 {connection.createdBy}</span>}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testConnection(connection.id)}
                      disabled={loading}
                    >
                      🧪 Test
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => editConnection(connection)}
                      disabled={loading}
                    >
                      ✏️ Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteConnection(connection.id)}
                      disabled={loading}
                      style={{ color: '#dc2626' }}
                    >
                      🗑️ Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
