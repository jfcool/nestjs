'use client';

import { useState, FormEvent } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { UserDto } from '@acme/api-types';
import {
  useGetUsers,
  useCreateUser,
  getGetUsersQueryKey,
} from '@acme/api-types';

export default function UsersPage() {
  // Liste laden
  const { data, isLoading, isError } = useGetUsers();
  const users = (data?.data as UserDto[]) ?? [];

  // Mutation für POST /users
  const qc = useQueryClient();
  const createUser = useCreateUser({
  mutation: {
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getGetUsersQueryKey() as any });
      setName('');
      setEmail('');
      setErr(null);
    },
    onError: (err) => setErr(err instanceof Error ? err.message : 'Unbekannter Fehler'),
  },
});

  // Formular-States
  const [name, setName] = useState('');
  const [email, setEmail] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);

 const onSubmit = (e: FormEvent) => {
  e.preventDefault();
  if (!name.trim()) {
    setErr('Name ist erforderlich');
    return;
  }
  createUser.mutate({
    data: {
      name: name.trim(),
      email: email.trim() || null,
    },
  });
};

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Users</h1>

      {/* Formular */}
      <form onSubmit={onSubmit} className="rounded-xl border p-4 grid gap-3 bg-white dark:bg-zinc-900">
        <div className="grid gap-1">
          <label htmlFor="name" className="text-sm font-medium">Name</label>
          <input
            id="name"
            className="border rounded px-3 py-2 bg-transparent"
            placeholder="z. B. Hans"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="grid gap-1">
          <label htmlFor="email" className="text-sm font-medium">E-Mail (optional)</label>
          <input
            id="email"
            className="border rounded px-3 py-2 bg-transparent"
            placeholder="hans@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}

        <button
          type="submit"
          disabled={createUser.isPending}
          className="inline-flex items-center justify-center rounded-lg border px-4 py-2 disabled:opacity-60"
        >
          {createUser.isPending ? 'Speichere…' : 'Anlegen'}
        </button>
      </form>

      {/* Liste */}
      {isLoading && <div>Lädt…</div>}
      {isError && <div className="text-red-600">Fehler beim Laden.</div>}
      {!isLoading && !isError && (
        <ul className="grid gap-3">
          {users.map((u) => (
            <li key={u.id} className="rounded-xl border p-4 bg-white dark:bg-zinc-900">
              <div className="font-medium">{u.name}</div>
              <div className="text-sm opacity-70">
                {u.email ?? <span className="italic">keine E-Mail</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
