// Temporary generated types - replace with proper orval generation when OpenAPI issues are resolved

export interface UserDto {
  id: number;
  name: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDto {
  name: string;
  email?: string;
}

// React Query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '../fetcher';

// Query keys
export const getGetUsersQueryKey = () => ['users'] as const;

// Users API hooks
export const useGetUsers = () => {
  return useQuery({
    queryKey: getGetUsersQueryKey(),
    queryFn: async (): Promise<UserDto[]> => {
      const response = await customFetch('/users');
      return response as UserDto[];
    },
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateUserDto): Promise<UserDto> => {
      const response = await customFetch('/users', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response as UserDto;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
    },
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CreateUserDto> }): Promise<UserDto> => {
      const response = await customFetch(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      return response as UserDto;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number): Promise<{ deleted: boolean }> => {
      const response = await customFetch(`/users/${id}`, {
        method: 'DELETE',
      });
      return response as { deleted: boolean };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
    },
  });
};
