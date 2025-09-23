'use client';

import React, { useState, useRef } from 'react';
import { Button } from './button';
import { Input } from './input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './dialog';
import { FolderIcon, FileIcon, ChevronRightIcon, ChevronDownIcon } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

interface FolderPickerProps {
  value?: string;
  onChange: (path: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

interface FileSystemItem {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileSystemItem[];
  expanded?: boolean;
}

export function FolderPicker({ value, onChange, placeholder, disabled }: FolderPickerProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState(value || '');
  const [fileSystem, setFileSystem] = useState<FileSystemItem[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mock file system data - in a real implementation, this would come from an API
  const mockFileSystem: FileSystemItem[] = [
    {
      name: 'Documents',
      path: '/Users/joe/Documents',
      isDirectory: true,
      children: [
        {
          name: 'Projects',
          path: '/Users/joe/Documents/Projects',
          isDirectory: true,
          children: [
            { name: 'project1.pdf', path: '/Users/joe/Documents/Projects/project1.pdf', isDirectory: false },
            { name: 'project2.md', path: '/Users/joe/Documents/Projects/project2.md', isDirectory: false },
          ]
        },
        { name: 'readme.txt', path: '/Users/joe/Documents/readme.txt', isDirectory: false },
      ]
    },
    {
      name: 'Desktop',
      path: '/Users/joe/Desktop',
      isDirectory: true,
      children: [
        { name: 'notes.md', path: '/Users/joe/Desktop/notes.md', isDirectory: false },
      ]
    },
    {
      name: 'Downloads',
      path: '/Users/joe/Downloads',
      isDirectory: true,
      children: []
    }
  ];

  React.useEffect(() => {
    setFileSystem(mockFileSystem);
  }, []);

  const handleFolderSelect = (path: string) => {
    setCurrentPath(path);
    onChange(path);
    setIsOpen(false);
  };

  const toggleExpanded = (item: FileSystemItem) => {
    const updateExpanded = (items: FileSystemItem[]): FileSystemItem[] => {
      return items.map(i => {
        if (i.path === item.path) {
          return { ...i, expanded: !i.expanded };
        }
        if (i.children) {
          return { ...i, children: updateExpanded(i.children) };
        }
        return i;
      });
    };
    setFileSystem(updateExpanded(fileSystem));
  };

  const renderFileSystemItem = (item: FileSystemItem, level: number = 0) => {
    const paddingLeft = level * 20;
    
    return (
      <div key={item.path}>
        <div
          className={`flex items-center py-2 px-2 hover:bg-gray-100 cursor-pointer rounded`}
          style={{ paddingLeft }}
          onClick={() => {
            if (item.isDirectory) {
              if (item.children && item.children.length > 0) {
                toggleExpanded(item);
              }
            }
          }}
        >
          <div className="flex items-center flex-1">
            {item.isDirectory && item.children && item.children.length > 0 && (
              <button
                className="mr-1 p-1"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpanded(item);
                }}
              >
                {item.expanded ? (
                  <ChevronDownIcon className="h-4 w-4" />
                ) : (
                  <ChevronRightIcon className="h-4 w-4" />
                )}
              </button>
            )}
            {item.isDirectory ? (
              <FolderIcon className="h-4 w-4 mr-2 text-blue-500" />
            ) : (
              <FileIcon className="h-4 w-4 mr-2 text-gray-500" />
            )}
            <span className="text-sm">{item.name}</span>
          </div>
          {item.isDirectory && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                handleFolderSelect(item.path);
              }}
            >
              {t('documents.indexing.selectFolder')}
            </Button>
          )}
        </div>
        {item.isDirectory && item.expanded && item.children && (
          <div>
            {item.children.map(child => renderFileSystemItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      // For file input, we get the first file's path
      const file = files[0];
      // In a real implementation, you'd handle file uploads here
      // For now, we'll just use the file name
      onChange(file.name);
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        value={currentPath}
        onChange={(e) => {
          setCurrentPath(e.target.value);
          onChange(e.target.value);
        }}
        placeholder={placeholder || t('documents.indexing.pathPlaceholder')}
        disabled={disabled}
        className="flex-1"
      />
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" disabled={disabled}>
            {t('documents.indexing.browseFolder')}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[600px]">
          <DialogHeader>
            <DialogTitle>{t('documents.indexing.selectFolder')}</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <div className="border rounded-lg p-4 max-h-[400px] overflow-y-auto">
              {loading ? (
                <div className="text-center py-8">
                  <div className="text-sm text-gray-500">{t('common.loading')}</div>
                </div>
              ) : (
                <div>
                  {fileSystem.map(item => renderFileSystemItem(item))}
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <div className="text-sm text-gray-600 mb-2">
                {t('documents.indexing.dragDropHint')}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.txt,.md,.docx"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                {t('documents.upload.selectFiles')}
              </Button>
              <div className="text-xs text-gray-500 mt-2 text-center">
                {t('documents.indexing.supportedFormats')}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
