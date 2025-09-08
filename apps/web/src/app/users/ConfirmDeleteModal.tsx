'use client';

import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import type { UserDto } from '@acme/api-types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

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
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Benutzer löschen
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            Sind Sie sicher, dass Sie den Benutzer{' '}
            <span className="font-semibold text-primary">
              "{user.name}"
            </span>{' '}
            löschen möchten?
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Diese Aktion kann nicht rückgängig gemacht werden.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel} 
            disabled={loading}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={loading}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {loading ? 'Lösche...' : 'Löschen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmDeleteModal;
