'use client';

import React, { useEffect } from 'react';
import { Modal, Form, Input, Button, message } from 'antd';
import { useUpdateUserWithBody, UserDto, CreateUserDto, getGetUsersQueryKey } from '@acme/api-types';
import { useQueryClient } from '@tanstack/react-query';

interface EditUserModalProps {
  open: boolean;
  onCancel: () => void;
  user: UserDto | null;
}

export default function EditUserModal({ open, onCancel, user }: EditUserModalProps) {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  
  const updateUserMutation = useUpdateUserWithBody({
    mutation: {
      onSuccess: () => {
        message.success('User updated successfully!');
        queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
        onCancel();
        form.resetFields();
      },
      onError: (error) => {
        console.error('Error updating user:', error);
        message.error('Failed to update user. Please try again.');
      },
    },
  });

  useEffect(() => {
    if (open) {
      if (user) {
        form.setFieldsValue({
          name: user.name,
          email: user.email || '',
        });
      } else {
        form.resetFields();
      }
    }
  }, [user, open, form]);

  const handleSubmit = async (values: CreateUserDto) => {
    if (!user) return;
    
    try {
      await updateUserMutation.mutateAsync({
        id: user.id,
        data: values,
      });
    } catch (error) {
      // Error is handled in onError callback
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title="Edit User"
      open={open}
      onCancel={handleCancel}
      footer={null}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        preserve={false}
      >
        <Form.Item
          label="Name"
          name="name"
          rules={[
            { required: true, message: 'Please enter a name' },
            { min: 2, message: 'Name must be at least 2 characters' },
          ]}
        >
          <Input placeholder="Enter user name" />
        </Form.Item>

        <Form.Item
          label="Email"
          name="email"
          rules={[
            { type: 'email', message: 'Please enter a valid email' },
          ]}
        >
          <Input placeholder="Enter user email (optional)" />
        </Form.Item>

        <Form.Item className="mb-0 flex justify-end">
          <div className="space-x-2">
            <Button onClick={handleCancel}>
              Cancel
            </Button>
            <Button 
              type="primary" 
              htmlType="submit"
              loading={updateUserMutation.isPending}
            >
              Update User
            </Button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}
