'use client';

import React from 'react';
import { Modal, Button, Space, Typography } from 'antd';
import { ExclamationCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import type { UserDto } from '@acme/api-types';

const { Text } = Typography;

interface ConfirmDeleteModalProps {
  open: boolean;
  user: UserDto | null;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  open,
  user,
  onConfirm,
  onCancel,
  loading = false,
}) => {
  if (!user) return null;

  return (
    <Modal
      open={open}
      title={
        <Space>
          <ExclamationCircleOutlined style={{ color: '#faad14' }} />
          <span>Benutzer löschen</span>
        </Space>
      }
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel} disabled={loading}>
          Abbrechen
        </Button>,
        <Button
          key="delete"
          type="primary"
          danger
          icon={<DeleteOutlined />}
          loading={loading}
          onClick={onConfirm}
        >
          Löschen
        </Button>,
      ]}
      centered
      width={400}
    >
      <div style={{ padding: '16px 0' }}>
        <Text>
          Sind Sie sicher, dass Sie den Benutzer{' '}
          <Text strong style={{ color: '#1890ff' }}>
            "{user.name}"
          </Text>{' '}
          löschen möchten?
        </Text>
        <br />
        <br />
        <Text type="secondary" style={{ fontSize: '12px' }}>
          Diese Aktion kann nicht rückgängig gemacht werden.
        </Text>
      </div>
    </Modal>
  );
};

export default ConfirmDeleteModal;
