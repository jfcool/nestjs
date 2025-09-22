'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { api, ApiError, NetworkError } from '@/lib/api-client';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  mcpToolCalls?: any[];
}

interface Conversation {
  id: string;
  title: string;
  model: string;
  mcpServers: string[];
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

interface McpServer {
  name: string;
  url: string;
  description: string;
  disabled?: boolean;
  tools: Array<{
    name: string;
    description: string;
    inputSchema: any;
  }>;
  resources: Array<{
    uri: string;
    name: string;
    description: string;
  }>;
}

interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  enabled: boolean;
  maxTokens: number;
  temperature: number;
}

type TabType = 'chat' | 'config';

export default function ChatPage() {
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [streamingStatus, setStreamingStatus] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [aiModels, setAiModels] = useState<AIModel[]>([]);
  const [defaultModel, setDefaultModel] = useState<AIModel | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [useMcp, setUseMcp] = useState(true);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentConversation?.messages]);

  useEffect(() => {
    fetchConversations();
    fetchMcpServers();
    fetchAiModels();
    fetchDefaultModel();
  }, []);

  const fetchConversations = async () => {
    try {
      const response = await api.chat.conversations.list();
      setConversations(response.data);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      const errorMessage = error instanceof ApiError 
        ? `API Error: ${error.message}` 
        : error instanceof NetworkError 
        ? `Network Error: ${error.message}`
        : 'Failed to fetch conversations';
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const fetchMcpServers = async () => {
    try {
      const response = await api.chat.mcp.servers();
      setMcpServers(response.data);
    } catch (error) {
      console.error('Error fetching MCP servers:', error);
      const errorMessage = error instanceof ApiError 
        ? `API Error: ${error.message}` 
        : error instanceof NetworkError 
        ? `Network Error: ${error.message}`
        : 'Failed to fetch MCP servers';
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const reloadMcpConfiguration = async () => {
    try {
      const response = await api.chat.mcp.reload();
      if (response.data.success) {
        await fetchMcpServers();
        toast({
          title: 'Success',
          description: 'MCP configuration reloaded successfully',
        });
      } else {
        toast({
          title: 'Error',
          description: response.data.message || 'Failed to reload MCP configuration',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error reloading MCP configuration:', error);
      const errorMessage = error instanceof ApiError 
        ? `API Error: ${error.message}` 
        : error instanceof NetworkError 
        ? `Network Error: ${error.message}`
        : 'Failed to reload MCP configuration';
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const fetchAiModels = async () => {
    try {
      const response = await api.chat.models.all();
      setAiModels(response.data);
    } catch (error) {
      console.error('Error fetching AI models:', error);
      const errorMessage = error instanceof ApiError 
        ? `API Error: ${error.message}` 
        : error instanceof NetworkError 
        ? `Network Error: ${error.message}`
        : 'Failed to fetch AI models';
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const fetchDefaultModel = async () => {
    try {
      const response = await api.chat.models.default();
      const defaultModelData = response.data;
      setDefaultModel(defaultModelData);
      setSelectedModel(defaultModelData.id);
    } catch (error) {
      console.error('Error fetching default model:', error);
      const errorMessage = error instanceof ApiError 
        ? `API Error: ${error.message}` 
        : error instanceof NetworkError 
        ? `Network Error: ${error.message}`
        : 'Failed to fetch default model';
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const setDefaultModelApi = async (modelId: string) => {
    try {
      const response = await api.chat.models.setDefault({ modelId });
      await fetchDefaultModel();
      toast({
        title: 'Success',
        description: 'Default model updated successfully',
      });
    } catch (error) {
      console.error('Error setting default model:', error);
      const errorMessage = error instanceof ApiError 
        ? `API Error: ${error.message}` 
        : error instanceof NetworkError 
        ? `Network Error: ${error.message}`
        : 'Failed to update default model';
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const createNewConversation = async () => {
    try {
      // Use selected model, default model, or first available enabled model
      const modelToUse = selectedModel || 
                        defaultModel?.id || 
                        aiModels.find(m => m.enabled)?.id || 
                        'local-llama';

      // Get only enabled MCP servers if MCP is enabled
      let mcpServerNames: string[] = [];
      if (useMcp) {
        try {
          const mcpResponse = await api.chat.mcp.servers();
          const mcpServers = mcpResponse.data;
          // Only include servers that are not disabled
          mcpServerNames = mcpServers
            .filter((server: any) => !server.disabled)
            .map((server: any) => server.name);
        } catch (error) {
          console.error('Error fetching MCP servers:', error);
          // No fallback - use empty array if MCP servers can't be fetched
          mcpServerNames = [];
        }
      }

      const response = await api.chat.conversations.create({
        title: 'New Conversation',
        model: modelToUse,
        mcpServers: mcpServerNames,
      });

      const newConversation = response.data;
      setConversations([newConversation, ...conversations]);
      setCurrentConversation(newConversation);
      setActiveTab('chat');
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to create new conversation',
        variant: 'destructive',
      });
    }
  };

  const sendStreamingMessage = async () => {
    if (!message.trim()) return;

    const userMessage = message;
    setMessage('');
    setIsLoading(true);

    // Immediately show user message
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
      createdAt: new Date().toISOString(),
    };

    if (currentConversation) {
      const updatedConversation = {
        ...currentConversation,
        messages: [...(currentConversation.messages || []), tempUserMessage],
      };
      setCurrentConversation(updatedConversation);
    }

    try {
      // Use regular message sending for now (fallback until SSE is fully working)
      const response = await api.chat.messages.send({
        content: userMessage,
        role: 'user',
        conversationId: currentConversation?.id,
        useMcp,
      });

      if (currentConversation) {
        const updatedConversation = {
          ...currentConversation,
          messages: [
            ...(currentConversation.messages || []).filter(m => m.id !== tempUserMessage.id),
            response.data.userMessage,
            response.data.assistantMessage
          ],
        };
        setCurrentConversation(updatedConversation);
        
        // Update conversations list
        setConversations(conversations.map(conv => 
          conv.id === currentConversation.id ? updatedConversation : conv
        ));
      }

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = error instanceof ApiError 
        ? `API Error: ${error.message}` 
        : error instanceof NetworkError 
        ? `Network Error: ${error.message}`
        : 'Failed to send message';
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    // Use streaming by default
    return sendStreamingMessage();
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      await api.chat.conversations.delete(conversationId);
      setConversations(conversations.filter(conv => conv.id !== conversationId));
      if (currentConversation?.id === conversationId) {
        setCurrentConversation(null);
      }
      toast({
        title: 'Success',
        description: 'Conversation deleted',
      });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      const errorMessage = error instanceof ApiError 
        ? `API Error: ${error.message}` 
        : error instanceof NetworkError 
        ? `Network Error: ${error.message}`
        : 'Failed to delete conversation';
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const startRenaming = (conversation: Conversation) => {
    setEditingConversationId(conversation.id);
    setEditingTitle(conversation.title);
  };

  const cancelRenaming = () => {
    setEditingConversationId(null);
    setEditingTitle('');
  };

  const saveRename = async (conversationId: string) => {
    if (!editingTitle.trim()) {
      cancelRenaming();
      return;
    }

    try {
      const response = await api.chat.conversations.update(conversationId, { title: editingTitle.trim() });
      const updatedConversation = response.data;
      setConversations(conversations.map(conv => 
        conv.id === conversationId ? { ...conv, title: updatedConversation.title } : conv
      ));
      
      if (currentConversation?.id === conversationId) {
        setCurrentConversation({ ...currentConversation, title: updatedConversation.title });
      }
      
      toast({
        title: 'Success',
        description: 'Conversation renamed',
      });
      
      cancelRenaming();
    } catch (error) {
      console.error('Error renaming conversation:', error);
      const errorMessage = error instanceof ApiError 
        ? `API Error: ${error.message}` 
        : error instanceof NetworkError 
        ? `Network Error: ${error.message}`
        : 'Failed to rename conversation';
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const renderChatTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-[calc(100vh-12rem)]">
      {/* Sidebar */}
      <div className="lg:col-span-1 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">💬 Chat AI</CardTitle>
            <Button onClick={createNewConversation} className="w-full">
              New Conversation
            </Button>
          </CardHeader>
        </Card>

        {/* Conversations List */}
        <Card className="flex-1 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-sm">
              Conversations ({conversations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-y-auto max-h-[60vh]">
            <div className="space-y-2">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`p-2 rounded hover:bg-gray-100 ${
                    currentConversation?.id === conv.id ? 'bg-blue-100' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => setCurrentConversation(conv)}
                    >
                      {editingConversationId === conv.id ? (
                        <div className="space-y-2">
                          <Input
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                saveRename(conv.id);
                              } else if (e.key === 'Escape') {
                                cancelRenaming();
                              }
                            }}
                            onBlur={() => saveRename(conv.id)}
                            className="text-sm"
                            autoFocus
                          />
                          <div className="flex gap-1 text-xs">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                saveRename(conv.id);
                              }}
                              className="h-6 px-2"
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                cancelRenaming();
                              }}
                              className="h-6 px-2"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-medium truncate">{conv.title}</p>
                          <p className="text-xs text-gray-500">
                            {conv.messages?.length || 0} messages
                          </p>
                          <div className="flex gap-1 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {aiModels.find(m => m.id === conv.model)?.name || conv.model}
                            </Badge>
                            {conv.mcpServers?.length > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                MCP
                              </Badge>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    
                    {editingConversationId !== conv.id && (
                      <div className="flex gap-1 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            startRenaming(conv);
                          }}
                          className="text-blue-500 hover:text-blue-700 h-6 w-6 p-0"
                          title="Rename conversation"
                        >
                          ✏️
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation(conv.id);
                          }}
                          className="text-red-500 hover:text-red-700 h-6 w-6 p-0"
                          title="Delete conversation"
                        >
                          🗑️
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chat Area */}
      <div className="lg:col-span-3 flex flex-col">
        <Card className="flex-1 flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg">
              {currentConversation ? currentConversation.title : 'Select a conversation or create a new one'}
            </CardTitle>
            {currentConversation && (
              <div className="flex gap-2">
                <Badge>{aiModels.find(m => m.id === currentConversation.model)?.name || currentConversation.model}</Badge>
                {currentConversation.mcpServers.length > 0 && (
                  <Badge variant="secondary">MCP: {currentConversation.mcpServers.join(', ')}</Badge>
                )}
              </div>
            )}
          </CardHeader>
          
          {currentConversation && (
            <>
              {/* Messages */}
              <CardContent className="flex-1 overflow-y-auto space-y-4">
                {(currentConversation.messages || []).map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <Avatar className="w-8 h-8 bg-blue-500 text-white flex items-center justify-center text-sm">
                        AI
                      </Avatar>
                    )}
                    <div
                      className={`max-w-[70%] p-3 rounded-lg ${
                        msg.role === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                      {msg.mcpToolCalls && msg.mcpToolCalls.length > 0 && (
                        <div className="mt-2 text-xs opacity-75">
                          <div className="flex flex-wrap gap-1">
                            {msg.mcpToolCalls.map((toolCall, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {toolCall.toolCall.serverName}.{toolCall.toolCall.toolName}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="text-xs opacity-75 mt-1">
                        {formatTimestamp(msg.createdAt)}
                      </div>
                    </div>
                    {msg.role === 'user' && (
                      <Avatar className="w-8 h-8 bg-green-500 text-white flex items-center justify-center text-sm">
                        U
                      </Avatar>
                    )}
                  </div>
                ))}

                {/* Streaming Status and Message */}
                {isStreaming && (
                  <>
                    {/* Status Indicator */}
                    {streamingStatus && (
                      <div className="flex gap-3 justify-start">
                        <Avatar className="w-8 h-8 bg-blue-500 text-white flex items-center justify-center text-sm">
                          AI
                        </Avatar>
                        <div className="max-w-[70%] p-3 rounded-lg bg-blue-50 border border-blue-200">
                          <div className="flex items-center gap-2 text-blue-600">
                            <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                            <span className="text-sm">{streamingStatus}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Streaming AI Response */}
                    {streamingMessage && (
                      <div className="flex gap-3 justify-start">
                        <Avatar className="w-8 h-8 bg-blue-500 text-white flex items-center justify-center text-sm">
                          AI
                        </Avatar>
                        <div className="max-w-[70%] p-3 rounded-lg bg-gray-100 text-gray-900">
                          <div className="whitespace-pre-wrap">{streamingMessage}</div>
                          <div className="flex items-center gap-1 mt-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                            <span className="text-xs text-gray-500 ml-2">Streaming...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div ref={messagesEndRef} />
              </CardContent>

              {/* Message Input */}
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message..."
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    disabled={isLoading || isStreaming}
                  />
                  <Button onClick={sendMessage} disabled={isLoading || isStreaming || !message.trim()}>
                    {isStreaming ? 'Streaming...' : isLoading ? 'Sending...' : 'Send'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );

  const renderConfigTab = () => (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* AI Models Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>AI Models</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Default Model</label>
            <div className="mt-2 space-y-2">
              {aiModels.map((model) => (
                <div key={model.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                  <input
                    type="radio"
                    id={model.id}
                    name="defaultModel"
                    checked={defaultModel?.id === model.id}
                    onChange={() => setDefaultModelApi(model.id)}
                    disabled={!model.enabled}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <label htmlFor={model.id} className="font-medium cursor-pointer">
                        {model.name}
                      </label>
                      <Badge variant={model.enabled ? 'default' : 'secondary'}>
                        {model.provider}
                      </Badge>
                      {!model.enabled && <Badge variant="outline">Disabled</Badge>}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{model.description}</p>
                    <div className="text-xs text-gray-500 mt-1">
                      Max Tokens: {model.maxTokens} | Temperature: {model.temperature}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">New Conversation Settings</label>
            <div className="mt-2 space-y-2">
              <div>
                <label className="text-sm">Model for new conversations:</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full mt-1 p-2 border rounded"
                >
                  <option value="">Use default model</option>
                  {aiModels.filter(m => m.enabled).map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MCP Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>MCP Integration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="useMcpGlobal"
              checked={useMcp}
              onChange={(e) => setUseMcp(e.target.checked)}
            />
            <label htmlFor="useMcpGlobal" className="text-sm font-medium">
              Enable MCP Tools for new conversations
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Available MCP Servers</label>
              <Button 
                onClick={reloadMcpConfiguration}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                🔄 Reload Configuration
              </Button>
            </div>
            <div className="mt-2 space-y-3">
              {mcpServers.map((server) => (
                <div key={server.name} className={`p-3 border rounded-lg ${server.disabled ? 'opacity-60 bg-gray-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{server.name}</h4>
                      <p className="text-sm text-gray-600">{server.description}</p>
                    </div>
                    <div className="flex gap-2">
                      {server.disabled ? (
                        <Badge variant="secondary">Disabled</Badge>
                      ) : (
                        <Badge variant="outline">Connected</Badge>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-500">
                    <div>Tools: {server.tools.length}</div>
                    <div>Resources: {server.resources.length}</div>
                  </div>
                  {!server.disabled && (
                    <div className="mt-2">
                      <details className="text-sm">
                        <summary className="cursor-pointer text-blue-600">View Tools</summary>
                        <div className="mt-2 space-y-1">
                          {server.tools.map((tool, idx) => (
                            <div key={idx} className="pl-4 border-l-2 border-gray-200">
                              <div className="font-mono text-xs">{tool.name}</div>
                              <div className="text-gray-600">{tool.description}</div>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}
                  {server.disabled && (
                    <div className="mt-2 text-xs text-gray-500 italic">
                      This server is disabled in the configuration. Enable it in conf.json and reload to use.
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="w-full max-w-none mx-auto p-2 sm:p-4 lg:p-6">
      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('chat')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'chat'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              💬 Chat
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'config'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              ⚙️ Configuration
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'chat' && renderChatTab()}
      {activeTab === 'config' && renderConfigTab()}
    </div>
  );
}
