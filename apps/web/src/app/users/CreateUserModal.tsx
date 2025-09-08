'use client';

import { useState } from 'react';
import { User, Mail } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateUser, getGetUsersQueryKey } from '@acme/api-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface CreateUserModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function CreateUserModal({ visible, onClose }: CreateUserModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const qc = useQueryClient();
  const { toast } = useToast();
  
  const createUser = useCreateUser({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetUsersQueryKey() as any });
        resetForm();
        onClose();
        toast({
          title: "Erfolg",
          description: "Benutzer erfolgreich erstellt!",
        });
      },
      onError: (err) => {
        toast({
          title: "Fehler",
          description: err instanceof Error ? err.message : 'Fehler beim Erstellen des Benutzers',
          variant: "destructive",
        });
      },
    },
  });

  const resetForm = () => {
    setName('');
    setEmail('');
    setNameError('');
    setEmailError('');
  };

  const validateForm = () => {
    let isValid = true;
    
    if (!name.trim()) {
      setNameError('Bitte geben Sie einen Namen ein!');
      isValid = false;
    } else if (name.trim().length < 2) {
      setNameError('Name muss mindestens 2 Zeichen lang sein!');
      isValid = false;
    } else {
      setNameError('');
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Bitte geben Sie eine gültige E-Mail-Adresse ein!');
      isValid = false;
    } else {
      setEmailError('');
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    createUser.mutate({
      data: {
        name: name.trim(),
        email: email.trim() || null,
      },
    });
  };

  const handleCancel = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={visible} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Neuen Benutzer erstellen
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="name"
                placeholder="z.B. Max Mustermann"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`pl-10 ${nameError ? 'border-destructive' : ''}`}
              />
            </div>
            {nameError && (
              <p className="text-sm text-destructive">{nameError}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              E-Mail-Adresse (optional)
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="max.mustermann@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`pl-10 ${emailError ? 'border-destructive' : ''}`}
              />
            </div>
            {emailError && (
              <p className="text-sm text-destructive">{emailError}</p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={createUser.isPending}>
              {createUser.isPending ? 'Erstelle...' : 'Benutzer erstellen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
