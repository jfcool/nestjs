/**
 * @fileoverview SAP OData Services Explorer - Main Application Component
 * 
 * This is the primary interface for exploring and interacting with SAP OData services.
 * It provides a comprehensive dashboard for managing SAP connections, discovering services,
 * viewing metadata, exploring data, and working with entity sets.
 * 
 * Key Features:
 * - Connection Management: Select and manage stored SAP connections
 * - Services Discovery: Load and explore available OData services from SAP systems
 * - Metadata Viewer: Display and analyze service metadata (XML format)
 * - Data Explorer: Query and view service data with JSON formatting
 * - Entity Sets Explorer: Interactive exploration of entity sets with advanced querying
 * - SAP Cloud SDK Integration: Professional SAP connectivity using official SDK
 * - Caching Support: Visual indicators for cached vs. live data from SAP systems
 * - Search & Filter: Advanced search capabilities across services and properties
 * 
 * Architecture:
 * - Tab-based navigation for different exploration modes
 * - Real-time connection status and validation
 * - Responsive design with comprehensive error handling
 * - Integration with AgentDB for performance caching
 * - Support for both direct connections and BTP destinations
 * 
 * Usage Flow:
 * 1. Select or create SAP connection
 * 2. Load available OData services
 * 3. Explore service metadata and data
 * 4. Use Entity Sets Explorer for detailed analysis
 * 5. Leverage SAP Cloud SDK for enterprise integration
 * 
 * @author NestJS SAP Integration Team
 * @version 2.0.0
 * @since 2024
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import EntitySetsViewer from './components/EntitySetsViewer';
import SapCloudSdkViewer from './components/SapCloudSdkViewer';
import { api, ApiError, NetworkError } from '@/lib/api-client';
import { useTranslation } from '@/lib/i18n';

interface ODataService {
  ServiceUrl: string | URL;
  MetadataUrl: string | URL;
  ID: string;
  Title: string;
  Author: string;
  UpdatedDate: string;
  TechnicalServiceName: string;
  TechnicalServiceVersion: number;
  Description?: string;
  Summary?: string;
}

interface ConnectionInfo {
  baseUrl: string;
  username: string;
  password: string;
  rejectUnauthorized: boolean;
}

interface StoredConnection {
  id: string;
  name: string;
  type: 'sap' | 'agentdb';
  baseUrl: string;
  username: string;
  description?: string;
  cacheConnectionName?: string;
  isActive: boolean;
}

interface SapODataResponse {
  content: string;
  contentType: string;
  url: string;
  isJson: boolean;
  parsedContent?: any;
  dataSource?: 'sap' | 'cache';
  cacheInfo?: {
    source: string;
    timestamp: string;
    servicePath: string;
  };
  sapInfo?: {
    timestamp: string;
    servicePath: string;
  };
}

export default function SapODataExplorer() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'services' | 'metadata' | 'data' | 'entitysets' | 'cloudsdk'>('services');
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<ODataService[]>([]);
  const [filteredServices, setFilteredServices] = useState<ODataService[]>([]);
  const [servicesResponse, setServicesResponse] = useState<SapODataResponse | null>(null);
  const [searchText, setSearchText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<ODataService | null>(null);
  const [showSettings, setShowSettings] = useState(true);
  const [metadata, setMetadata] = useState<string>('');
  const [metadataResponse, setMetadataResponse] = useState<SapODataResponse | null>(null);
  const [serviceData, setServiceData] = useState<any>(null);
  const [serviceDataResponse, setServiceDataResponse] = useState<SapODataResponse | null>(null);

  // Connection management
  const [storedConnections, setStoredConnections] = useState<StoredConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [selectedConnection, setSelectedConnection] = useState<StoredConnection | null>(null);
  const router = useRouter();

  // Legacy connection settings (for backward compatibility)
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>({
    baseUrl: 'https://54.81.18.66:44301',
    username: 'Everest',
    password: 'Welcome1',
    rejectUnauthorized: false,
  });

  // Load stored connections on component mount
  useEffect(() => {
    fetchStoredConnections();
  }, []);

  // Filter services based on search text
  useEffect(() => {
    if (searchText) {
      const searchWords = searchText.toLowerCase().trim().split(/\s+/).filter(word => word.length > 0);
      const filtered = services.filter((service) => {
        const searchableText = [
          service.Title,
          service.TechnicalServiceName,
          service.ID,
          service.Author || '',
          service.Summary || '',
          service.Description || ''
        ].join(' ').toLowerCase();
        
        return searchWords.every(word => searchableText.includes(word));
      });
      setFilteredServices(filtered);
    } else {
      setFilteredServices(services);
    }
  }, [searchText, services]);

  // Update selected connection when connectionId changes
  useEffect(() => {
    if (selectedConnectionId && storedConnections.length > 0) {
      const connection = storedConnections.find(conn => conn.id === selectedConnectionId);
      setSelectedConnection(connection || null);
    } else {
      setSelectedConnection(null);
    }
  }, [selectedConnectionId, storedConnections]);

  const fetchStoredConnections = async () => {
    try {
      const response = await api.sapOData.connections.list();
      const connections = response.data;
      setStoredConnections(connections);
      
      // Auto-select the first active connection if none is selected
      if (!selectedConnectionId && connections.length > 0) {
        const activeConnection = connections.find((conn: StoredConnection) => conn.isActive) || connections[0];
        setSelectedConnectionId(activeConnection.id);
      }
    } catch (error) {
      console.error('Error fetching stored connections:', error);
      const errorMessage = error instanceof ApiError 
        ? `API Error: ${error.message}` 
        : error instanceof NetworkError 
        ? `Network Error: ${error.message}`
        : 'Failed to fetch stored connections';
      setError(errorMessage);
    }
  };

  const fetchServices = async () => {
    if (!selectedConnection) {
      setError('Please select a connection first');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await api.sapOData.connections.catalog(selectedConnection.id, {});
      const result: SapODataResponse = response.data;
      
      // Store the complete response for cache indicators
      setServicesResponse(result);
      
      if (result.isJson && result.parsedContent?.d?.results) {
        setServices(result.parsedContent.d.results);
        setFilteredServices(result.parsedContent.d.results);
      } else {
        throw new Error('Invalid response format from SAP system');
      }
    } catch (error) {
      console.error('Error fetching SAP OData services:', error);
      const errorMessage = error instanceof ApiError 
        ? `API Error: ${error.message}` 
        : error instanceof NetworkError 
        ? `Network Error: ${error.message}`
        : error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async (service: ODataService) => {
    if (!selectedConnection) {
      setError('Please select a connection first');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const metadataPath = new URL(service.MetadataUrl).pathname;
      
      const response = await api.sapOData.connections.metadata(selectedConnection.id, {
        servicePath: metadataPath,
      });

      const result: SapODataResponse = response.data;
      setMetadata(result.content);
      setMetadataResponse(result);
      setSelectedService(service);
      setActiveTab('metadata');
    } catch (error) {
      console.error('Error fetching metadata:', error);
      const errorMessage = error instanceof ApiError 
        ? `API Error: ${error.message}` 
        : error instanceof NetworkError 
        ? `Network Error: ${error.message}`
        : error instanceof Error ? error.message : 'Failed to fetch metadata';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchServiceData = async (service: ODataService) => {
    if (!selectedConnection) {
      setError('Please select a connection first');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const dataPath = `${new URL(service.ServiceUrl).pathname}/`;
      
      const response = await api.sapOData.connections.data(selectedConnection.id, {
        servicePath: dataPath,
      });

      const result: SapODataResponse = response.data;
      setServiceData(result.parsedContent);
      setServiceDataResponse(result);
      setSelectedService(service);
      setActiveTab('data');
    } catch (error) {
      console.error('Error fetching service data:', error);
      const errorMessage = error instanceof ApiError 
        ? `API Error: ${error.message}` 
        : error instanceof NetworkError 
        ? `Network Error: ${error.message}`
        : error instanceof Error ? error.message : 'Failed to fetch service data';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      let date: Date;
      if (dateStr.includes('/Date(')) {
        const timestamp = dateStr.match(/\/Date\((\d+)\)\//);
        if (timestamp) {
          date = new Date(parseInt(timestamp[1]));
        } else {
          return 'Invalid Date';
        }
      } else {
        date = new Date(dateStr);
      }
      return date.toLocaleDateString();
    } catch {
      return 'Invalid Date';
    }
  };

  // Helper function to extract the correct service name from service URL
  const getServiceNameFromUrl = (service: ODataService): string => {
    try {
      // Extract service name from ServiceUrl path
      // Example: "/sap/opu/odata/sap/API_BUSINESS_PARTNER/" -> "API_BUSINESS_PARTNER"
      const url = new URL(service.ServiceUrl);
      const pathParts = url.pathname.split('/').filter(part => part.length > 0);
      
      // Look for the pattern: sap/opu/odata/sap/SERVICE_NAME
      // Find the last 'sap' in the path (there are usually two)
      let lastSapIndex = -1;
      for (let i = pathParts.length - 1; i >= 0; i--) {
        if (pathParts[i].toLowerCase() === 'sap') {
          lastSapIndex = i;
          break;
        }
      }
      
      // If we found 'sap' and there's a part after it, that's our service name
      if (lastSapIndex >= 0 && lastSapIndex < pathParts.length - 1) {
        return pathParts[lastSapIndex + 1];
      }
      
      // Fallback: use the last non-empty path segment
      const lastPart = pathParts[pathParts.length - 1];
      if (lastPart && lastPart.toLowerCase() !== 'sap') {
        return lastPart;
      }
      
      // Final fallback: use TechnicalServiceName
      return service.TechnicalServiceName;
    } catch (error) {
      console.warn('Failed to extract service name from URL, using TechnicalServiceName:', error);
      return service.TechnicalServiceName;
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: 'none', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#1e3a8a', color: 'white', padding: '24px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0 0 8px 0' }}>
          {t('sap.title')}
        </h1>
        <p style={{ color: '#bfdbfe', margin: 0 }}>
          {t('sap.description')}
        </p>
      </div>

      <div style={{ width: '100%', maxWidth: 'none', margin: '0 auto', padding: '12px 16px' }} className="sm:px-6 lg:px-8">
        {/* Connection Selection Card */}
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '8px', 
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)', 
          marginBottom: '24px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                🔗 {t('sap.connections')}
              </h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => router.push('/sapodata/connections')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  ⚙️ Manage Connections
                </button>
                <button
                  onClick={fetchStoredConnections}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'transparent',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  🔄 Refresh
                </button>
              </div>
            </div>
          </div>
          <div style={{ padding: '16px' }}>
            {storedConnections.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔗</div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '8px' }}>
                  No Connections Available
                </h3>
                <p style={{ color: '#6b7280', marginBottom: '16px' }}>
                  Create your first SAP connection to start exploring OData services.
                </p>
                <button
                  onClick={() => router.push('/sapodata/connections')}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Create Connection
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                    Select Connection
                  </label>
                  <select
                    value={selectedConnectionId}
                    onChange={(e) => setSelectedConnectionId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: 'white'
                    }}
                  >
                    <option value="">Select a connection...</option>
                    {storedConnections.map((connection) => (
                      <option key={connection.id} value={connection.id}>
                        {connection.name} ({connection.type?.toUpperCase() || 'UNKNOWN'}) - {connection.baseUrl}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedConnection && (
                  <div style={{ 
                    backgroundColor: '#f9fafb', 
                    padding: '12px', 
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 8px 0' }}>
                      Connection Details
                    </h4>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      <div><strong>Name:</strong> {selectedConnection.name}</div>
                      <div><strong>Type:</strong> {selectedConnection.type?.toUpperCase() || 'UNKNOWN'}</div>
                      <div><strong>URL:</strong> {selectedConnection.baseUrl}</div>
                      <div><strong>Username:</strong> {selectedConnection.username}</div>
                      {selectedConnection.description && (
                        <div><strong>Description:</strong> {selectedConnection.description}</div>
                      )}
                      {selectedConnection.cacheConnectionName && (
                        <div><strong>Cache Connection:</strong> {selectedConnection.cacheConnectionName}</div>
                      )}
                      <div>
                        <strong>Status:</strong> 
                        <span style={{ 
                          color: selectedConnection.isActive ? '#059669' : '#dc2626',
                          marginLeft: '4px'
                        }}>
                          {selectedConnection.isActive ? '✅ Active' : '❌ Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{ 
            backgroundColor: '#fef2f2', 
            border: '1px solid #fecaca', 
            borderRadius: '8px', 
            padding: '16px', 
            marginBottom: '24px',
            color: '#991b1b'
          }}>
            {error}
          </div>
        )}

        {/* Tab Navigation */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
            <button
              onClick={() => setActiveTab('services')}
              style={{
                padding: '12px 16px',
                backgroundColor: activeTab === 'services' ? '#eff6ff' : 'transparent',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: activeTab === 'services' ? '2px solid #3b82f6' : 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: activeTab === 'services' ? '600' : '400',
                color: activeTab === 'services' ? '#3b82f6' : '#6b7280'
              }}
            >
              🗄️ Services Explorer
            </button>
            <button
              onClick={() => setActiveTab('metadata')}
              disabled={!selectedService}
              style={{
                padding: '12px 16px',
                backgroundColor: activeTab === 'metadata' ? '#eff6ff' : 'transparent',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: activeTab === 'metadata' ? '2px solid #3b82f6' : 'none',
                cursor: selectedService ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: activeTab === 'metadata' ? '600' : '400',
                color: selectedService ? (activeTab === 'metadata' ? '#3b82f6' : '#6b7280') : '#d1d5db'
              }}
            >
              📄 Metadata Viewer
            </button>
            <button
              onClick={() => setActiveTab('data')}
              disabled={!selectedService}
              style={{
                padding: '12px 16px',
                backgroundColor: activeTab === 'data' ? '#eff6ff' : 'transparent',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: activeTab === 'data' ? '2px solid #3b82f6' : 'none',
                cursor: selectedService ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: activeTab === 'data' ? '600' : '400',
                color: selectedService ? (activeTab === 'data' ? '#3b82f6' : '#6b7280') : '#d1d5db'
              }}
            >
              📊 Data Explorer
            </button>
            <button
              onClick={() => setActiveTab('entitysets')}
              disabled={!selectedService}
              style={{
                padding: '12px 16px',
                backgroundColor: activeTab === 'entitysets' ? '#eff6ff' : 'transparent',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: activeTab === 'entitysets' ? '2px solid #3b82f6' : 'none',
                cursor: selectedService ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: activeTab === 'entitysets' ? '600' : '400',
                color: selectedService ? (activeTab === 'entitysets' ? '#3b82f6' : '#6b7280') : '#d1d5db'
              }}
            >
              🗂️ Entity Sets
            </button>
            <button
              onClick={() => setActiveTab('cloudsdk')}
              style={{
                padding: '12px 16px',
                backgroundColor: activeTab === 'cloudsdk' ? '#eff6ff' : 'transparent',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: activeTab === 'cloudsdk' ? '2px solid #3b82f6' : 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: activeTab === 'cloudsdk' ? '600' : '400',
                color: activeTab === 'cloudsdk' ? '#3b82f6' : '#6b7280'
              }}
            >
              ☁️ SAP Cloud SDK
            </button>
          </div>
        </div>

        {/* Services Tab */}
        {activeTab === 'services' && (
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '8px', 
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Available Services</h2>
                  {/* Services Catalog Cache Indicator */}
                  {servicesResponse && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {servicesResponse.dataSource === 'cache' ? (
                        <span style={{ 
                          backgroundColor: '#fef3c7', 
                          color: '#92400e', 
                          padding: '4px 8px', 
                          borderRadius: '12px', 
                          fontSize: '12px',
                          fontWeight: '500',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          🗄️ Catalog from Cache
                          {servicesResponse.cacheInfo?.source && (
                            <span style={{ fontSize: '10px', opacity: 0.8 }}>
                              ({servicesResponse.cacheInfo.source})
                            </span>
                          )}
                        </span>
                      ) : servicesResponse.dataSource === 'sap' ? (
                        <span style={{ 
                          backgroundColor: '#dcfce7', 
                          color: '#166534', 
                          padding: '4px 8px', 
                          borderRadius: '12px', 
                          fontSize: '12px',
                          fontWeight: '500',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          🌐 Catalog from SAP System
                        </span>
                      ) : null}
                      {/* Timestamp */}
                      {(servicesResponse.cacheInfo?.timestamp || servicesResponse.sapInfo?.timestamp) && (
                        <span style={{ fontSize: '10px', color: '#9ca3af' }}>
                          Retrieved: {new Date(servicesResponse.cacheInfo?.timestamp || servicesResponse.sapInfo?.timestamp || '').toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={fetchServices}
                  disabled={loading || !selectedConnection}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: loading || !selectedConnection ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    opacity: loading || !selectedConnection ? 0.6 : 1
                  }}
                >
                  {loading ? '⏳ Loading...' : (services.length > 0 ? '🔄 Refresh' : '📡 Load Services')}
                </button>
              </div>

              {services.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <input
                    type="text"
                    placeholder="🔍 Search services..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '8px 0 0 0' }}>
                    Showing {filteredServices.length} of {services.length} services
                    {searchText && ` (filtered by "${searchText}")`}
                  </p>
                </div>
              )}
            </div>

            <div style={{ padding: '16px' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '48px' }}>
                  <div style={{ fontSize: '24px', marginBottom: '16px' }}>⏳</div>
                  <p>{t('sap.loadingServices')}</p>
                </div>
              ) : services.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚀</div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '8px' }}>
                    Welcome to SAP OData Services Explorer
                  </h3>
                  <p style={{ color: '#6b7280' }}>
                    Select a connection and click "Load Services" to discover available OData services.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '16px' }}>
                  {filteredServices.map((service) => (
                    <div
                      key={service.ID}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '16px',
                        backgroundColor: '#fafafa',
                        transition: 'box-shadow 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ 
                            fontSize: '1rem', 
                            fontWeight: '600', 
                            color: '#3b82f6', 
                            margin: '0 0 4px 0' 
                          }}>
                            {service.Title}
                          </h3>
                          <p style={{ 
                            fontSize: '14px', 
                            color: '#6b7280', 
                            margin: '0 0 8px 0',
                            fontFamily: 'monospace'
                          }}>
                            {service.TechnicalServiceName}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ 
                              backgroundColor: '#dbeafe', 
                              color: '#1e40af', 
                              padding: '2px 8px', 
                              borderRadius: '12px', 
                              fontSize: '12px' 
                            }}>
                              v{service.TechnicalServiceVersion}
                            </span>
                            <span style={{ fontSize: '12px', color: '#6b7280' }}>{service.Author}</span>
                            <span style={{ fontSize: '12px', color: '#6b7280' }}>{formatDate(service.UpdatedDate)}</span>
                          </div>
                          {service.Description && (
                            <p style={{ fontSize: '14px', color: '#374151', margin: '0' }}>
                              {service.Description.length > 150 
                                ? `${service.Description.slice(0, 150)}...` 
                                : service.Description}
                            </p>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginLeft: '16px' }}>
                          <button
                            onClick={() => fetchMetadata(service)}
                            disabled={loading}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: 'white',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              cursor: loading ? 'not-allowed' : 'pointer',
                              fontSize: '12px',
                              opacity: loading ? 0.6 : 1
                            }}
                          >
                            📄 Metadata
                          </button>
                          <button
                            onClick={() => fetchServiceData(service)}
                            disabled={loading}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: 'white',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              cursor: loading ? 'not-allowed' : 'pointer',
                              fontSize: '12px',
                              opacity: loading ? 0.6 : 1
                            }}
                          >
                            📊 Data
                          </button>
                          <button
                            onClick={() => {
                              setSelectedService(service);
                              setActiveTab('entitysets');
                            }}
                            disabled={loading}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: loading ? 'not-allowed' : 'pointer',
                              fontSize: '12px',
                              opacity: loading ? 0.6 : 1
                            }}
                          >
                            🗂️ Entity Sets
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Metadata Tab */}
        {activeTab === 'metadata' && (
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '8px', 
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>
                  Metadata: {selectedService?.Title}
                </h2>
                <button
                  onClick={() => setActiveTab('services')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  ← Back to Services
                </button>
              </div>
            </div>
            <div style={{ padding: '16px' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '48px' }}>
                  <div style={{ fontSize: '24px', marginBottom: '16px' }}>⏳</div>
                  <p>Loading metadata...</p>
                </div>
              ) : metadata ? (
                <div>
                  {/* Data Source Indicator for Metadata */}
                  {metadataResponse && (
                    <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <span style={{ 
                        backgroundColor: '#f3f4f6', 
                        color: '#374151', 
                        padding: '4px 8px', 
                        borderRadius: '12px', 
                        fontSize: '12px' 
                      }}>
                        XML Metadata
                      </span>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>
                        {metadata.length.toLocaleString()} characters
                      </span>
                      {metadataResponse.dataSource === 'cache' ? (
                        <span style={{ 
                          backgroundColor: '#fef3c7', 
                          color: '#92400e', 
                          padding: '4px 8px', 
                          borderRadius: '12px', 
                          fontSize: '12px',
                          fontWeight: '500',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          🗄️ From Cache
                          {metadataResponse.cacheInfo?.source && (
                            <span style={{ fontSize: '10px', opacity: 0.8 }}>
                              ({metadataResponse.cacheInfo.source})
                            </span>
                          )}
                        </span>
                      ) : metadataResponse.dataSource === 'sap' ? (
                        <span style={{ 
                          backgroundColor: '#dcfce7', 
                          color: '#166534', 
                          padding: '4px 8px', 
                          borderRadius: '12px', 
                          fontSize: '12px',
                          fontWeight: '500',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          🌐 From SAP System
                        </span>
                      ) : null}
                      {/* Timestamp */}
                      {(metadataResponse.cacheInfo?.timestamp || metadataResponse.sapInfo?.timestamp) && (
                        <span style={{ fontSize: '10px', color: '#9ca3af' }}>
                          Retrieved: {new Date(metadataResponse.cacheInfo?.timestamp || metadataResponse.sapInfo?.timestamp || '').toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                  <div style={{ 
                    backgroundColor: '#f3f4f6', 
                    padding: '16px', 
                    borderRadius: '8px', 
                    overflow: 'auto', 
                    maxHeight: '400px' 
                  }}>
                    <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', margin: 0 }}>{metadata}</pre>
                  </div>
                </div>
              ) : (
                <p style={{ color: '#6b7280' }}>No metadata available</p>
              )}
            </div>
          </div>
        )}

        {/* Data Tab */}
        {activeTab === 'data' && (
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '8px', 
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>
                  Data: {selectedService?.Title}
                </h2>
                <button
                  onClick={() => setActiveTab('services')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  ← Back to Services
                </button>
              </div>
            </div>
            <div style={{ padding: '16px' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '48px' }}>
                  <div style={{ fontSize: '24px', marginBottom: '16px' }}>⏳</div>
                  <p>Loading data...</p>
                </div>
              ) : serviceData ? (
                <div>
                  {/* Data Source Indicator for Service Data */}
                  {serviceDataResponse && (
                    <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <span style={{ 
                        backgroundColor: '#dbeafe', 
                        color: '#1e40af', 
                        padding: '4px 8px', 
                        borderRadius: '12px', 
                        fontSize: '12px' 
                      }}>
                        JSON Data
                      </span>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>
                        {serviceDataResponse.content.length.toLocaleString()} characters
                      </span>
                      {serviceDataResponse.dataSource === 'cache' ? (
                        <span style={{ 
                          backgroundColor: '#fef3c7', 
                          color: '#92400e', 
                          padding: '4px 8px', 
                          borderRadius: '12px', 
                          fontSize: '12px',
                          fontWeight: '500',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          🗄️ From Cache
                          {serviceDataResponse.cacheInfo?.source && (
                            <span style={{ fontSize: '10px', opacity: 0.8 }}>
                              ({serviceDataResponse.cacheInfo.source})
                            </span>
                          )}
                        </span>
                      ) : serviceDataResponse.dataSource === 'sap' ? (
                        <span style={{ 
                          backgroundColor: '#dcfce7', 
                          color: '#166534', 
                          padding: '4px 8px', 
                          borderRadius: '12px', 
                          fontSize: '12px',
                          fontWeight: '500',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          🌐 From SAP System
                        </span>
                      ) : null}
                      {/* Timestamp */}
                      {(serviceDataResponse.cacheInfo?.timestamp || serviceDataResponse.sapInfo?.timestamp) && (
                        <span style={{ fontSize: '10px', color: '#9ca3af' }}>
                          Retrieved: {new Date(serviceDataResponse.cacheInfo?.timestamp || serviceDataResponse.sapInfo?.timestamp || '').toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                  <div style={{ 
                    backgroundColor: '#f3f4f6', 
                    padding: '16px', 
                    borderRadius: '8px', 
                    overflow: 'auto', 
                    maxHeight: '400px' 
                  }}>
                    <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', margin: 0 }}>
                      {JSON.stringify(serviceData, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <p style={{ color: '#6b7280' }}>No data available</p>
              )}
            </div>
          </div>
        )}

        {/* Entity Sets Tab */}
        {activeTab === 'entitysets' && selectedService && selectedConnection && (
          <EntitySetsViewer
            serviceName={getServiceNameFromUrl(selectedService)}
            connectionId={selectedConnection.id}
            onBack={() => setActiveTab('services')}
          />
        )}

        {/* SAP Cloud SDK Tab */}
        {activeTab === 'cloudsdk' && (
          <SapCloudSdkViewer
            onBack={() => setActiveTab('services')}
          />
        )}
      </div>
    </div>
  );
}
