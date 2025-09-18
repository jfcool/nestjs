'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';

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
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [aiModels, setAiModels] = useState<AIModel[]>([]);
  const [defaultModel, setDefaultModel] = useState<AIModel | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [useMcp, setUseMcp] = useState(true);
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
      const response = await fetch('http://localhost:3001/chat/conversations');
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch conversations',
        variant: 'destructive',
      });
    }
  };

  const fetchMcpServers = async () => {
    try {
      const response = await fetch('http://localhost:3001/chat/mcp/servers');
      if (response.ok) {
        const data = await response.json();
        setMcpServers(data);
      }
    } catch (error) {
      console.error('Error fetching MCP servers:', error);
    }
  };

  const reloadMcpConfiguration = async () => {
    try {
      const response = await fetch('http://localhost:3001/chat/mcp/reload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          await fetchMcpServers();
          toast({
            title: 'Success',
            description: 'MCP configuration reloaded successfully',
          });
        } else {
          toast({
            title: 'Error',
            description: result.message || 'Failed to reload MCP configuration',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      console.error('Error reloading MCP configuration:', error);
      toast({
        title: 'Error',
        description: 'Failed to reload MCP configuration',
        variant: 'destructive',
      });
    }
  };

  const fetchAiModels = async () => {
    try {
      const response = await fetch('http://localhost:3001/chat/models/all');
      if (response.ok) {
        const data = await response.json();
        setAiModels(data);
      }
    } catch (error) {
      console.error('Error fetching AI models:', error);
    }
  };

  const fetchDefaultModel = async () => {
    try {
      const response = await fetch('http://localhost:3001/chat/models/default');
      if (response.ok) {
        const data = await response.json();
        setDefaultModel(data);
        setSelectedModel(data.id);
      }
    } catch (error) {
      console.error('Error fetching default model:', error);
    }
  };

  const setDefaultModelApi = async (modelId: string) => {
    try {
      const response = await fetch('http://localhost:3001/chat/models/default', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ modelId }),
      });

      if (response.ok) {
        await fetchDefaultModel();
        toast({
          title: 'Success',
          description: 'Default model updated successfully',
        });
      }
    } catch (error) {
      console.error('Error setting default model:', error);
      toast({
        title: 'Error',
        description: 'Failed to update default model',
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
          const mcpResponse = await fetch('http://localhost:3001/chat/mcp/servers');
          if (mcpResponse.ok) {
            const mcpServers = await mcpResponse.json();
            // Only include servers that are not disabled
            mcpServerNames = mcpServers
              .filter((server: any) => !server.disabled)
              .map((server: any) => server.name);
          }
        } catch (error) {
          console.error('Error fetching MCP servers:', error);
          // No fallback - use empty array if MCP servers can't be fetched
          mcpServerNames = [];
        }
      }

      const response = await fetch('http://localhost:3001/chat/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'New Conversation',
          model: modelToUse,
          mcpServers: mcpServerNames,
        }),
      });

      if (response.ok) {
        const newConversation = await response.json();
        setConversations([newConversation, ...conversations]);
        setCurrentConversation(newConversation);
        setActiveTab('chat');
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to create new conversation',
        variant: 'destructive',
      });
    }
  };

  const sendMessage = async () => {
    if (!message.trim()) return;

    setIsLoading(true);
    const userMessage = message;
    setMessage('');

    try {
      const response = await fetch('http://localhost:3001/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: userMessage,
          role: 'user',
          conversationId: currentConversation?.id,
          useMcp,
        }),
      });

      if (response.ok) {
        const { userMessage: newUserMessage, assistantMessage } = await response.json();
        
        if (currentConversation) {
          const updatedConversation = {
            ...currentConversation,
            messages: [...(currentConversation.messages || []), newUserMessage, assistantMessage],
          };
          setCurrentConversation(updatedConversation);
          
          // Update conversations list
          setConversations(conversations.map(conv => 
            conv.id === currentConversation.id ? updatedConversation : conv
          ));
        } else {
          // If no current conversation, fetch the updated conversation
          fetchConversations();
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/chat/conversations/${conversationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setConversations(conversations.filter(conv => conv.id !== conversationId));
        if (currentConversation?.id === conversationId) {
          setCurrentConversation(null);
        }
        toast({
          title: 'Success',
          description: 'Conversation deleted',
        });
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete conversation',
        variant: 'destructive',
      });
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const renderChatTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-12rem)]">
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
            <CardTitle className="text-sm">Conversations</CardTitle>
          </CardHeader>
          <CardContent className="overflow-y-auto max-h-96">
            <div className="space-y-2">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`p-2 rounded cursor-pointer hover:bg-gray-100 ${
                    currentConversation?.id === conv.id ? 'bg-blue-100' : ''
                  }`}
                  onClick={() => setCurrentConversation(conv)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
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
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conv.id);
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      ×
                    </Button>
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
                    disabled={isLoading}
                  />
                  <Button onClick={sendMessage} disabled={isLoading || !message.trim()}>
                    {isLoading ? 'Sending...' : 'Send'}
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
    <div className="max-w-7xl mx-auto p-4">
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
