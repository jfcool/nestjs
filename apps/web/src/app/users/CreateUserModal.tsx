'use client';

import { useState } from 'react';
import { Modal, Form, Input, Button, message } from 'antd';
import { UserOutlined, MailOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateUser, getGetUsersQueryKey } from '@acme/api-types';

interface CreateUserModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function CreateUserModal({ visible, onClose }: CreateUserModalProps) {
  const [form] = Form.useForm();
  const qc = useQueryClient();
  
  const createUser = useCreateUser({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetUsersQueryKey() as any });
        form.resetFields();
        onClose();
        message.success('Benutzer erfolgreich erstellt!');
      },
      onError: (err) => {
        message.error(err instanceof Error ? err.message : 'Fehler beim Erstellen des Benutzers');
      },
    },
  });

  const handleSubmit = async (values: { name: string; email?: string }) => {
    createUser.mutate({
      data: {
        name: values.name.trim(),
        email: values.email?.trim() || null,
      },
    });
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UserOutlined />
          <span>Neuen Benutzer erstellen</span>
        </div>
      }
      open={visible}
      onCancel={handleCancel}
      footer={null}
      width={500}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        style={{ marginTop: '20px' }}
      >
        <Form.Item
          label="Name"
          name="name"
          rules={[
            { required: true, message: 'Bitte geben Sie einen Namen ein!' },
            { min: 2, message: 'Name muss mindestens 2 Zeichen lang sein!' }
          ]}
        >
          <Input
            prefix={<UserOutlined />}
            placeholder="z.B. Max Mustermann"
            size="large"
          />
        </Form.Item>

        <Form.Item
          label="E-Mail-Adresse (optional)"
          name="email"
          rules={[
            { type: 'email', message: 'Bitte geben Sie eine gültige E-Mail-Adresse ein!' }
          ]}
        >
          <Input
            prefix={<MailOutlined />}
            placeholder="max.mustermann@example.com"
            size="large"
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button onClick={handleCancel}>
              Abbrechen
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createUser.isPending}
            >
              Benutzer erstellen
            </Button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}
