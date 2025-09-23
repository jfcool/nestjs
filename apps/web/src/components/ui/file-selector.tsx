'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Button } from './button';
import { Card, CardContent } from './card';
import { Badge } from './badge';
import { useTranslation } from '@/lib/i18n';
import { 
  FolderIcon, 
  FileIcon, 
  XIcon, 
  UploadIcon,
  FolderOpenIcon,
  FileTextIcon,
  ImageIcon,
  FileVideoIcon
} from 'lucide-react';

interface SelectedFile {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
  isDirectory: boolean;
  file?: File;
}

interface FileSelectorProps {
  selectedFiles: SelectedFile[];
  onFilesChange: (files: SelectedFile[]) => void;
  disabled?: boolean;
  acceptedTypes?: string[];
  maxFiles?: number;
}

export function FileSelector({ 
  selectedFiles, 
  onFilesChange, 
  disabled = false,
  acceptedTypes = ['.pdf', '.txt', '.md', '.docx', '.doc', '.rtf'],
  maxFiles = 10
}: FileSelectorProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const getFileIcon = (fileName: string, isDirectory: boolean) => {
    if (isDirectory) return <FolderIcon className="h-4 w-4 text-blue-500" />;
    
    const ext = fileName.toLowerCase().split('.').pop();
    switch (ext) {
      case 'pdf':
        return <FileTextIcon className="h-4 w-4 text-red-500" />;
      case 'txt':
      case 'md':
      case 'rtf':
        return <FileTextIcon className="h-4 w-4 text-gray-500" />;
      case 'doc':
      case 'docx':
        return <FileTextIcon className="h-4 w-4 text-blue-600" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return <ImageIcon className="h-4 w-4 text-green-500" />;
      case 'mp4':
      case 'avi':
      case 'mov':
        return <FileVideoIcon className="h-4 w-4 text-purple-500" />;
      default:
        return <FileIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const addFiles = useCallback((files: File[]) => {
    const newFiles: SelectedFile[] = [];
    
    Array.from(files).forEach((file) => {
      // Check if file already exists
      const exists = selectedFiles.some(f => f.name === file.name && f.size === file.size);
      if (exists) return;

      // Check file type
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!acceptedTypes.includes(fileExt)) return;

      // Check max files limit
      if (selectedFiles.length + newFiles.length >= maxFiles) return;

      const selectedFile: SelectedFile = {
        id: `${file.name}-${file.size}-${Date.now()}`,
        name: file.name,
        path: file.webkitRelativePath || file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        isDirectory: false,
        file: file
      };

      newFiles.push(selectedFile);
    });

    if (newFiles.length > 0) {
      onFilesChange([...selectedFiles, ...newFiles]);
    }
  }, [selectedFiles, onFilesChange, acceptedTypes, maxFiles]);

  const handleFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFolderSelect = () => {
    if (folderInputRef.current) {
      folderInputRef.current.click();
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      addFiles(Array.from(files));
    }
    // Reset input value to allow selecting the same file again
    event.target.value = '';
  };

  const handleFolderInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      addFiles(Array.from(files));
    }
    // Reset input value
    event.target.value = '';
  };

  const removeFile = (fileId: string) => {
    onFilesChange(selectedFiles.filter(f => f.id !== fileId));
  };

  const clearAll = () => {
    onFilesChange([]);
  };

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      addFiles(files);
    }
  }, [disabled, addFiles]);

  return (
    <div className="space-y-4">
      {/* File Input Controls */}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleFileSelect}
          disabled={disabled || selectedFiles.length >= maxFiles}
          className="flex items-center gap-2"
        >
          <FileIcon className="h-4 w-4" />
          {t('documents.upload.selectFiles')}
        </Button>
        
        <Button
          type="button"
          variant="outline"
          onClick={handleFolderSelect}
          disabled={disabled || selectedFiles.length >= maxFiles}
          className="flex items-center gap-2"
        >
          <FolderOpenIcon className="h-4 w-4" />
          {t('documents.indexing.browseFolder')}
        </Button>

        {selectedFiles.length > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={clearAll}
            disabled={disabled}
            className="flex items-center gap-2 text-red-600 hover:text-red-700"
          >
            <XIcon className="h-4 w-4" />
            Clear All
          </Button>
        )}
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedTypes.join(',')}
        onChange={handleFileInputChange}
        className="hidden"
      />
      
      <input
        ref={folderInputRef}
        type="file"
        multiple
        // @ts-ignore - webkitdirectory is not in the types but is supported
        webkitdirectory=""
        onChange={handleFolderInputChange}
        className="hidden"
      />

      {/* Drag & Drop Area */}
      <Card
        className={`border-2 border-dashed transition-colors ${
          isDragOver 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={!disabled ? handleFileSelect : undefined}
      >
        <CardContent className="p-8 text-center">
          <UploadIcon className={`h-12 w-12 mx-auto mb-4 ${
            isDragOver ? 'text-blue-500' : 'text-gray-400'
          }`} />
          <p className="text-lg font-medium mb-2">
            {t('documents.indexing.dragDropHint')}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            {t('documents.indexing.supportedFormats')}
          </p>
          <p className="text-xs text-muted-foreground">
            Maximum {maxFiles} files • {acceptedTypes.join(', ')}
          </p>
        </CardContent>
      </Card>

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium">
                Selected Files ({selectedFiles.length}/{maxFiles})
              </h3>
              <Badge variant="secondary">
                Total: {formatFileSize(selectedFiles.reduce((sum, f) => sum + f.size, 0))}
              </Badge>
            </div>
            
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {selectedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getFileIcon(file.name, file.isDirectory)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate" title={file.path}>
                        {file.path}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {formatFileSize(file.size)}
                    </Badge>
                  </div>
                  
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(file.id)}
                    disabled={disabled}
                    className="ml-2 text-red-600 hover:text-red-700"
                  >
                    <XIcon className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
