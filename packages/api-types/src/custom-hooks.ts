import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutationOptions, UseMutationResult } from '@tanstack/react-query';
import { customFetch } from './fetcher';
import { UserDto, CreateUserDto, getGetUsersQueryKey } from './gen';

// Custom updateUser function that includes the request body
export const updateUserWithBody = async (
  id: number,
  data: Partial<CreateUserDto>,
  options?: RequestInit
): Promise<{ data: UserDto; status: 200; headers: Headers }> => {
  return customFetch<{ data: UserDto; status: 200; headers: Headers }>(
    `/users/${id}`,
    {
      ...options,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      body: JSON.stringify(data),
    }
  );
};

// Custom hook for updating users with proper body parameter
export const useUpdateUserWithBody = <TError = unknown, TContext = unknown>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof updateUserWithBody>>,
      TError,
      { id: number; data: Partial<CreateUserDto> },
      TContext
    >;
  }
): UseMutationResult<
  Awaited<ReturnType<typeof updateUserWithBody>>,
  TError,
  { id: number; data: Partial<CreateUserDto> },
  TContext
> => {
  const queryClient = useQueryClient();

  const mutationOptions = {
    mutationKey: ['updateUser'],
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateUserDto> }) =>
      updateUserWithBody(id, data),
    onSuccess: () => {
      // Invalidate users queries to refetch data
      queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
    },
    ...options?.mutation,
  };

  return useMutation(mutationOptions);
};

// Custom deleteUser function
export const deleteUserById = async (
  id: number,
  options?: RequestInit
): Promise<{ status: 200; headers: Headers }> => {
  return customFetch<{ status: 200; headers: Headers }>(
    `/users/${id}`,
    {
      ...options,
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    }
  );
};

// Custom hook for deleting users
export const useDeleteUserCustom = <TError = unknown, TContext = unknown>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof deleteUserById>>,
      TError,
      { id: number },
      TContext
    >;
  }
): UseMutationResult<
  Awaited<ReturnType<typeof deleteUserById>>,
  TError,
  { id: number },
  TContext
> => {
  const queryClient = useQueryClient();

  const mutationOptions = {
    mutationKey: ['deleteUser'],
    mutationFn: ({ id }: { id: number }) => deleteUserById(id),
    onSuccess: () => {
      // Invalidate users queries to refetch data
      queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
    },
    ...options?.mutation,
  };

  return useMutation(mutationOptions);
};
