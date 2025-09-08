'use client';

import React, { useEffect, useState } from 'react';
import { useUpdateUserWithBody, UserDto, CreateUserDto, getGetUsersQueryKey } from '@acme/api-types';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface EditUserModalProps {
  open: boolean;
  onCancel: () => void;
  user: UserDto | null;
}

export default function EditUserModal({ open, onCancel, user }: EditUserModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const updateUserMutation = useUpdateUserWithBody({
    mutation: {
      onSuccess: () => {
        toast({
          title: "Erfolg",
          description: "Benutzer erfolgreich aktualisiert!",
        });
        queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
        onCancel();
        resetForm();
      },
      onError: (error) => {
        console.error('Error updating user:', error);
        toast({
          title: "Fehler",
          description: "Fehler beim Aktualisieren des Benutzers. Bitte versuchen Sie es erneut.",
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

  useEffect(() => {
    if (open && user) {
      setName(user.name);
      setEmail(user.email || '');
      setNameError('');
      setEmailError('');
    } else if (open && !user) {
      resetForm();
    }
  }, [user, open]);

  const validateForm = () => {
    let isValid = true;
    
    if (!name.trim()) {
      setNameError('Bitte geben Sie einen Namen ein');
      isValid = false;
    } else if (name.trim().length < 2) {
      setNameError('Name muss mindestens 2 Zeichen lang sein');
      isValid = false;
    } else {
      setNameError('');
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Bitte geben Sie eine gültige E-Mail-Adresse ein');
      isValid = false;
    } else {
      setEmailError('');
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !validateForm()) return;
    
    const values: CreateUserDto = {
      name: name.trim(),
      email: email.trim() || null,
    };
    
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
    resetForm();
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Benutzer bearbeiten</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="edit-name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="edit-name"
              placeholder="Benutzername eingeben"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={nameError ? 'border-destructive' : ''}
            />
            {nameError && (
              <p className="text-sm text-destructive">{nameError}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="edit-email" className="text-sm font-medium">
              E-Mail
            </label>
            <Input
              id="edit-email"
              type="email"
              placeholder="Benutzer E-Mail eingeben (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={emailError ? 'border-destructive' : ''}
            />
            {emailError && (
              <p className="text-sm text-destructive">{emailError}</p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Abbrechen
            </Button>
            <Button 
              type="submit" 
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending ? 'Aktualisiere...' : 'Benutzer aktualisieren'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
