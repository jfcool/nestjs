'use client';

import React, { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Typography,
  notification,
  Spin,
  Input,
  Tag,
  Space,
  Button,
  Row,
  Col,
  Statistic,
  Avatar,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  UserOutlined,
  MailOutlined,
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { UserDto } from '@acme/api-types';
import { useGetUsers } from '@acme/api-types';
import CreateUserModal from './CreateUserModal';

const { Title, Text } = Typography;
const { Search } = Input;

export default function UsersPage() {
  const { data, isLoading, isError } = useGetUsers();
  const users = (data?.data as UserDto[]) ?? [];
  const [searchText, setSearchText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  // Filter users based on search text
  const filteredUsers = React.useMemo(() => {
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
  const stats = {
    total: users.length,
    withEmail: users.filter(u => u.email).length,
    withoutEmail: users.filter(u => !u.email).length,
    recentlyCreated: users.filter(u => u.id > Math.max(0, Math.max(...users.map(u => u.id)) - 2)).length,
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const columns: ColumnsType<UserDto> = [
    {
      title: 'Benutzer Information',
      key: 'userInfo',
      render: (_, user) => (
        <div>
          <div style={{ marginBottom: '8px' }}>
            <Space>
              <Avatar 
                style={{ backgroundColor: '#1890ff' }}
                icon={<UserOutlined />}
              >
                {getInitials(user.name)}
              </Avatar>
              <div>
                <Text strong style={{ color: '#1890ff', fontSize: '14px' }}>
                  {user.name}
                </Text>
                <div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Benutzer #{user.id}
                  </Text>
                </div>
              </div>
            </Space>
          </div>
        </div>
      ),
      width: 250,
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'E-Mail',
      key: 'email',
      render: (_, user) => (
        <div>
          {user.email ? (
            <Space>
              <MailOutlined style={{ color: '#52c41a' }} />
              <Text style={{ fontSize: '12px' }}>
                {user.email}
              </Text>
            </Space>
          ) : (
            <Space>
              <ExclamationCircleOutlined style={{ color: '#faad14' }} />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                Keine E-Mail
              </Text>
            </Space>
          )}
        </div>
      ),
      width: 200,
      sorter: (a, b) => (a.email || '').localeCompare(b.email || ''),
    },
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      sorter: (a, b) => a.id - b.id,
      render: (id) => (
        <Tag color="blue" style={{ fontSize: '11px' }}>
          #{id}
        </Tag>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, user) => {
        const hasEmail = !!user.email;
        return (
          <Tag 
            color={hasEmail ? 'green' : 'orange'} 
            icon={hasEmail ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
            style={{ fontSize: '11px' }}
          >
            {hasEmail ? 'Vollständig' : 'Unvollständig'}
          </Tag>
        );
      },
      width: 120,
      sorter: (a, b) => (!!a.email ? 1 : 0) - (!!b.email ? 1 : 0),
    },
    {
      title: 'Aktionen',
      key: 'actions',
      render: (_, user) => (
        <Space>
          <Tooltip title="Bearbeiten">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              style={{ color: '#1890ff' }}
            />
          </Tooltip>
          <Tooltip title="Löschen">
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              style={{ color: '#ff4d4f' }}
            />
          </Tooltip>
        </Space>
      ),
      width: 100,
    },
  ];

  if (isError) {
    return (
      <div style={{ padding: '20px' }}>
        <Card>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '48px', color: '#ff4d4f', marginBottom: '16px' }}>⚠️</div>
            <Title level={3} type="danger">
              Verbindungsfehler
            </Title>
            <Text>Fehler beim Laden der Benutzerliste. Bitte versuchen Sie es erneut.</Text>
            <div style={{ marginTop: '20px' }}>
              <Button type="primary" onClick={() => window.location.reload()}>
                🔄 Erneut versuchen
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <Card style={{ marginBottom: '20px', borderRadius: '12px' }}>
        <Row gutter={[16, 16]} align="middle" style={{ marginBottom: '20px' }}>
          <Col xs={24} sm={6} lg={4}>
            <Button
              onClick={() => setModalVisible(true)}
              type="primary"
              size="large"
              icon={<PlusOutlined />}
              style={{ width: '100%' }}
            >
              Benutzer hinzufügen
            </Button>
          </Col>
          <Col xs={24} sm={12} lg={16} style={{ textAlign: 'center' }}>
            <Title level={1} style={{ margin: 0, color: '#1890ff', fontSize: '28px' }}>
              🔗 Benutzerverwaltung
            </Title>
            <Text style={{ fontSize: '14px', color: '#666', margin: '4px 0 0 0' }}>
              Verwalten Sie Benutzerkonten und deren Informationen
            </Text>
          </Col>
          <Col xs={24} sm={6} lg={4}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                System bereit
              </div>
              <div style={{ fontSize: '10px', color: '#999' }}>
                {users.length} Benutzer geladen
              </div>
            </div>
          </Col>
        </Row>

        {/* Statistics Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: '20px' }}>
          <Col xs={24} sm={12} md={6}>
            <Card size="small" style={{ textAlign: 'center', borderRadius: '8px' }}>
              <Statistic
                title="Gesamt Benutzer"
                value={stats.total}
                prefix={<TeamOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card size="small" style={{ textAlign: 'center', borderRadius: '8px' }}>
              <Statistic
                title="Mit E-Mail"
                value={stats.withEmail}
                prefix={<MailOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card size="small" style={{ textAlign: 'center', borderRadius: '8px' }}>
              <Statistic
                title="Ohne E-Mail"
                value={stats.withoutEmail}
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card size="small" style={{ textAlign: 'center', borderRadius: '8px' }}>
              <Statistic
                title="Kürzlich erstellt"
                value={stats.recentlyCreated}
                prefix={<ThunderboltOutlined />}
                valueStyle={{ color: '#722ed1' }}
                suffix={`/ ${stats.total}`}
              />
            </Card>
          </Col>
        </Row>

        {/* Search */}
        <Row gutter={[16, 16]} align="middle" style={{ marginBottom: '16px' }}>
          <Col xs={24} md={12}>
            <div>
              <Text strong style={{ marginBottom: '8px', display: 'block' }}>
                Benutzer suchen:
              </Text>
              <Search
                placeholder="Benutzer suchen..."
                allowClear
                enterButton={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </Col>
          <Col xs={24} md={12}>
            <Text type="secondary" style={{ fontSize: '14px' }}>
              Zeige {filteredUsers.length} von {users.length} Benutzern
              {searchText && ` (gefiltert nach "${searchText}")`}
            </Text>
          </Col>
        </Row>
      </Card>

      {/* Users Table */}
      <Card style={{ borderRadius: '12px' }}>
        <Spin spinning={isLoading}>
          {!isLoading && filteredUsers.length === 0 && !searchText ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: '64px', marginBottom: '24px' }}>🚀</div>
              <Title level={3} style={{ color: '#1890ff', marginBottom: '16px' }}>
                Willkommen zur Benutzerverwaltung
              </Title>
              <Text style={{ fontSize: '16px', color: '#666', marginBottom: '32px', maxWidth: '600px', margin: '0 auto 32px' }}>
                Erstellen Sie Ihren ersten Benutzer, um loszulegen.
              </Text>
              <Button
                type="primary"
                size="large"
                icon={<PlusOutlined />}
                onClick={() => setModalVisible(true)}
              >
                Ersten Benutzer erstellen
              </Button>
            </div>
          ) : (
            <Table
              columns={columns}
              dataSource={filteredUsers}
              rowKey="id"
              pagination={{
                defaultPageSize: 50,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `Zeige ${range[0]}-${range[1]} von ${total} Benutzern`,
                pageSizeOptions: ['25', '50', '100', '200'],
              }}
              scroll={{ x: 800, y: 600 }}
              size="middle"
              bordered={false}
            />
          )}
        </Spin>
      </Card>

      {/* Create User Modal */}
      <CreateUserModal 
        visible={modalVisible} 
        onClose={() => setModalVisible(false)} 
      />
    </div>
  );
}
