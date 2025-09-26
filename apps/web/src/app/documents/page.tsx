'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FileSelector } from '@/components/ui/file-selector';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/lib/i18n';
import { 
  useGetDocuments, 
  useGetDocumentStats, 
  useSearchDocuments, 
  useIndexPath, 
  useTestEmbeddingService,
  useClearAllDocuments,
  type Document,
  type SearchResult,
  type DocumentStats
} from '@/lib/documents-api';
import { 
  SearchIcon, 
  FolderIcon, 
  FileTextIcon, 
  DatabaseIcon,
  RefreshCwIcon,
  FilterIcon,
  SortAscIcon
} from 'lucide-react';

// Define SelectedFile type to match FileSelector
interface SelectedFile {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
  isDirectory: boolean;
  file?: File;
}

export default function DocumentsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [manualPath, setManualPath] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');
  const [similarityThreshold, setSimilarityThreshold] = useState<number>(0.1); // Default 10%

  // API hooks
  const { data: documents = [], isLoading: documentsLoading, refetch: refetchDocuments } = useGetDocuments();
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useGetDocumentStats();
  const { mutate: searchDocuments, isLoading: searchLoading } = useSearchDocuments();
  const { mutate: indexPathMutation, isLoading: indexLoading } = useIndexPath();
  const { mutate: testEmbedding, isLoading: testLoading } = useTestEmbeddingService();
  const { mutate: clearAllDocuments, isLoading: clearLoading } = useClearAllDocuments();

  // Handlers
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      const results = await searchDocuments({
        query: searchQuery,
        threshold: similarityThreshold
      });
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
      toast({
        title: 'Search Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleIndexFiles = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: t('documents.indexing.indexingFailed'),
        description: t('documents.indexing.pathRequired'),
        variant: 'destructive',
      });
      return;
    }

    // Check if any files only have filenames (no full paths)
    const filesWithoutPaths = selectedFiles.filter(file => {
      const pathToCheck = file.path || (file.file?.webkitRelativePath) || file.name;
      return pathToCheck === file.name && !pathToCheck.includes('/') && !pathToCheck.includes('\\');
    });

    if (filesWithoutPaths.length > 0) {
      // Auto-populate manual path input with the first filename
      const firstFile = filesWithoutPaths[0];
      setManualPath(firstFile.name);
      
      toast({
        title: 'Browser Security Limitation',
        description: `Due to browser security, only the filename "${firstFile.name}" is available. Please complete the full path in the manual input field above and use "Index Path" instead.`,
        variant: 'destructive',
      });
      
      // Clear the file selector since it can't provide full paths
      setSelectedFiles([]);
      return;
    }

    try {
      // Index each selected file using its full path
      for (const file of selectedFiles) {
        let pathToIndex = file.path || file.file?.webkitRelativePath || file.name;
        
        console.log('Attempting to index path:', pathToIndex);
        console.log('File object:', file);
        
        const result = await indexPathMutation(pathToIndex);
        console.log('Indexing result:', result);
        
        toast({
          title: t('documents.indexing.indexingComplete'),
          description: t('documents.indexing.indexedSuccessfully', { path: pathToIndex }),
        });
      }
      
      setSelectedFiles([]);
      refetchDocuments();
      refetchStats();
    } catch (error) {
      console.error('Indexing error details:', error);
      
      let errorMessage = t('errors.generic');
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      // Check for specific error types
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        errorMessage = 'Authentication required. Please log in first.';
      } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        errorMessage = 'Permission denied. You need documents:write permission.';
      } else if (errorMessage.includes('500')) {
        errorMessage = 'Server error. Check the backend logs for details.';
      } else if (errorMessage.includes('Network error')) {
        errorMessage = 'Cannot connect to the server. Is the backend running?';
      } else if (errorMessage.includes('does not exist')) {
        errorMessage = `File not found. Please provide the complete file path manually above.`;
      }
      
      toast({
        title: t('documents.indexing.indexingFailed'),
        description: `${errorMessage}\n\nTechnical details: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };

  const handleIndexManualPath = async () => {
    if (!manualPath.trim()) {
      toast({
        title: t('documents.indexing.indexingFailed'),
        description: 'Please enter a file path',
        variant: 'destructive',
      });
      return;
    }

    try {
      console.log('Attempting to index manual path:', manualPath);
      const result = await indexPathMutation(manualPath);
      console.log('Indexing result:', result);
      
      toast({
        title: t('documents.indexing.indexingComplete'),
        description: t('documents.indexing.indexedSuccessfully', { path: manualPath }),
      });
      setManualPath('');
      refetchDocuments();
      refetchStats();
    } catch (error) {
      console.error('Indexing error details:', error);
      
      let errorMessage = t('errors.generic');
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      // Check for specific error types
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        errorMessage = 'Authentication required. Please log in first.';
      } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        errorMessage = 'Permission denied. You need documents:write permission.';
      } else if (errorMessage.includes('500')) {
        errorMessage = 'Server error. Check the backend logs for details.';
      } else if (errorMessage.includes('Network error')) {
        errorMessage = 'Cannot connect to the server. Is the backend running?';
      } else if (errorMessage.includes('does not exist')) {
        errorMessage = 'File or directory not found. Please check the path and ensure it exists.';
      }
      
      toast({
        title: t('documents.indexing.indexingFailed'),
        description: `${errorMessage}\n\nTechnical details: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };

  const handleIndexFolder = async () => {
    if (!folderPath.trim()) {
      toast({
        title: 'Folder Path Required',
        description: 'Please enter a folder path',
        variant: 'destructive',
      });
      return;
    }

    try {
      console.log('Attempting to index folder:', folderPath);
      
      // Show initial success message
      toast({
        title: 'Folder Indexing Started',
        description: `Scanning and indexing all supported files in: ${folderPath}. This may take a while for large folders.`,
      });
      
      const result = await indexPathMutation(folderPath);
      console.log('Folder indexing result:', result);
      
      // Show completion message
      toast({
        title: 'Folder Indexing Complete',
        description: `Successfully indexed all supported files in: ${folderPath}. Check the backend logs for details.`,
      });
      
      setFolderPath('');
      
      // Refresh data multiple times to catch ongoing indexing
      refetchDocuments();
      refetchStats();
      
      // Refresh again after a delay to catch any remaining files
      setTimeout(() => {
        refetchDocuments();
        refetchStats();
      }, 2000);
      
      setTimeout(() => {
        refetchDocuments();
        refetchStats();
      }, 5000);
      
    } catch (error) {
      console.error('Folder indexing error details:', error);
      
      let errorMessage = 'Failed to index folder';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      // Check for specific error types
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        errorMessage = 'Authentication required. Please log in first.';
      } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        errorMessage = 'Permission denied. You need documents:write permission.';
      } else if (errorMessage.includes('500')) {
        errorMessage = 'Server error. Check the backend logs for details.';
      } else if (errorMessage.includes('Network error')) {
        errorMessage = 'Cannot connect to the server. Is the backend running?';
      } else if (errorMessage.includes('does not exist')) {
        errorMessage = 'Folder not found. Please check the path and ensure it exists.';
      }
      
      toast({
        title: 'Folder Indexing Failed',
        description: `${errorMessage}\n\nTechnical details: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };

  const handleTestEmbedding = async () => {
    try {
      const result = await testEmbedding();
      toast({
        title: t('documents.embedding.testComplete'),
        description: result.connected 
          ? t('documents.embedding.connected', { dimensions: result.dimensions })
          : t('documents.embedding.failed', { error: 'Connection failed' }),
        variant: result.connected ? 'default' : 'destructive',
      });
    } catch (error) {
      toast({
        title: t('documents.embedding.testFailed'),
        description: error instanceof Error ? error.message : t('errors.generic'),
        variant: 'destructive',
      });
    }
  };

  const handleClearAllDocuments = async () => {
    // Show confirmation dialog
    const confirmed = window.confirm(
      '⚠️ WARNUNG: Alle Dokumente und Chunks werden unwiderruflich aus der Datenbank gelöscht!\n\n' +
      'Diese Aktion kann nicht rückgängig gemacht werden.\n\n' +
      'Möchten Sie wirklich fortfahren?'
    );

    if (!confirmed) return;

    try {
      await clearAllDocuments();
      
      toast({
        title: '🗑️ Alle Indizes gelöscht',
        description: 'Alle Dokumente und Chunks wurden erfolgreich aus der Datenbank entfernt.',
      });
      
      // Refresh data to show empty state
      refetchDocuments();
      refetchStats();
      
      // Clear search results
      setSearchResults([]);
      
    } catch (error) {
      console.error('Clear all documents error:', error);
      
      let errorMessage = 'Fehler beim Löschen der Dokumente';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: '❌ Löschen fehlgeschlagen',
        description: `${errorMessage}\n\nTechnische Details: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        variant: 'destructive',
      });
    }
  };

  // Filter and sort documents
  const filteredAndSortedDocuments = React.useMemo(() => {
    if (!documents || !Array.isArray(documents)) {
      return [];
    }
    
    let filtered = documents;
    
    if (fileTypeFilter !== 'all') {
      filtered = documents.filter(doc => doc && doc.fileType && doc.fileType.toLowerCase() === fileTypeFilter.toLowerCase());
    }

    return filtered.sort((a, b) => {
      if (!a || !b) return 0;
      
      switch (sortBy) {
        case 'name':
          return (a.title || '').localeCompare(b.title || '');
        case 'size':
          return (b.fileSize || 0) - (a.fileSize || 0);
        case 'date':
        default:
          const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return dateB - dateA;
      }
    });
  }, [documents, fileTypeFilter, sortBy]);

  // Get unique file types for filter
  const fileTypes = React.useMemo(() => {
    if (!documents || !Array.isArray(documents)) {
      return [];
    }
    const types = new Set(documents.filter(doc => doc && doc.fileType).map(doc => doc.fileType));
    return Array.from(types);
  }, [documents]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{t('documents.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('documents.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleClearAllDocuments} 
            variant="destructive"
            disabled={clearLoading}
          >
            🗑️ {clearLoading ? 'Lösche...' : 'Lösche alle Indizes'}
          </Button>
          <Button 
            onClick={handleTestEmbedding} 
            variant="outline"
            disabled={testLoading}
          >
            <DatabaseIcon className="h-4 w-4 mr-2" />
            {testLoading ? t('common.loading') : t('documents.embedding.testService')}
          </Button>
          <Button 
            onClick={() => {
              refetchDocuments();
              refetchStats();
            }}
            variant="outline"
            disabled={documentsLoading || statsLoading}
          >
            <RefreshCwIcon className="h-4 w-4 mr-2" />
            {t('common.refresh')}
          </Button>
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {t('documents.statistics.totalDocuments')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalDocuments}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {t('documents.statistics.totalChunks')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalChunks}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {t('documents.statistics.averageChunkSize')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageChunkSize}</div>
              <p className="text-xs text-muted-foreground">{t('documents.statistics.tokens')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {t('documents.statistics.withEmbeddings')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.documentsWithEmbeddings}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Index Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderIcon className="h-5 w-5" />
            {t('documents.indexing.title')}
          </CardTitle>
          <CardDescription>
            Index documents by specifying file or folder paths
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Single File Path */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">📄 Index Single File</h4>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter full file path (e.g., /Users/joe/Documents/myfile.pdf)"
                  value={manualPath}
                  onChange={(e) => setManualPath(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  onClick={handleIndexManualPath} 
                  disabled={indexLoading || !manualPath.trim()}
                  variant="outline"
                >
                  {indexLoading ? 'Indexing...' : 'Index File'}
                </Button>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            {/* Folder Path */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">📁 Index Entire Folder</h4>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter folder path (e.g., /Users/joe/Documents/MyFolder)"
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  onClick={handleIndexFolder} 
                  disabled={indexLoading || !folderPath.trim()}
                  variant="default"
                >
                  {indexLoading ? 'Indexing...' : 'Index Folder'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                ✅ Automatically finds all supported files (.pdf, .docx, .txt, .md, .html, .json, .csv) in the folder and subfolders
              </p>
            </div>

            {/* Quick Folder Suggestions */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">🚀 Quick Folder Access</h4>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setFolderPath('/Users/joe/Documents')}
                >
                  📁 Documents
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setFolderPath('/Users/joe/Desktop')}
                >
                  🖥️ Desktop
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setFolderPath('/Users/joe/Downloads')}
                >
                  📥 Downloads
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SearchIcon className="h-5 w-5" />
            {t('documents.search.title')}
          </CardTitle>
          <CardDescription>
            {t('documents.search.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder={t('documents.search.placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium whitespace-nowrap">
                  Similarity:
                </label>
                <select
                  value={similarityThreshold}
                  onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
                  className="px-3 py-2 border rounded-md text-sm w-20"
                >
                  <option value={0.05}>5%</option>
                  <option value={0.1}>10%</option>
                  <option value={0.15}>15%</option>
                  <option value={0.2}>20%</option>
                  <option value={0.3}>30%</option>
                  <option value={0.5}>50%</option>
                  <option value={0.7}>70%</option>
                </select>
              </div>
              <Button 
                onClick={handleSearch} 
                disabled={searchLoading || !searchQuery.trim()}
              >
                {searchLoading ? t('documents.search.searching') : t('documents.search.searchButton')}
              </Button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold">
                  {t('documents.search.resultsCount', { count: searchResults.length })}
                </h3>
                {searchResults.map((result, index) => (
                  <Card key={result.chunkId} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium">{result.documentTitle}</h4>
                        <p className="text-sm text-muted-foreground">{result.documentPath}</p>
                      </div>
                      <Badge variant="secondary">
                        {t('documents.search.score')}: {result.score.toFixed(3)}
                      </Badge>
                    </div>
                    <p className="text-sm">{result.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {t('documents.search.chunk', { index: result.chunkIndex + 1 })}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Document List */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileTextIcon className="h-5 w-5" />
                {t('documents.list.title')}
              </CardTitle>
              <CardDescription>
                {t('documents.list.description')}
              </CardDescription>
            </div>
            
            {/* Filters and Sort */}
            <div className="flex gap-2">
              <select
                value={fileTypeFilter}
                onChange={(e) => setFileTypeFilter(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="all">{t('documents.filters.allTypes')}</option>
                {fileTypes.map(type => (
                  <option key={type} value={type}>{type.toUpperCase()}</option>
                ))}
              </select>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'date' | 'size')}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="date">{t('documents.filters.date')}</option>
                <option value="name">{t('documents.filters.name')}</option>
                <option value="size">{t('documents.filters.size')}</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {documentsLoading ? (
            <div className="text-center py-8">
              <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
            </div>
          ) : filteredAndSortedDocuments.length === 0 ? (
            <div className="text-center py-8">
              <FileTextIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t('documents.list.noDocuments')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAndSortedDocuments.map((doc) => (
                <Card key={doc.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium">{doc.title}</h4>
                      <p className="text-sm text-muted-foreground">{doc.path}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline">{doc.fileType.toUpperCase()}</Badge>
                        <Badge variant="outline">
                          {t('documents.list.fileSize', { size: (doc.fileSize / 1024).toFixed(1) })}
                        </Badge>
                        <Badge variant="outline">
                          {doc.chunkCount !== undefined ? `${doc.chunkCount} Chunks` : 'Loading...'}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <p>Erstellt: {new Date(doc.createdAt).toLocaleString('de-DE', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}</p>
                      <p>Aktualisiert: {new Date(doc.updatedAt).toLocaleString('de-DE', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
