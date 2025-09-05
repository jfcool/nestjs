'use client';

import React, { useState, useEffect } from 'react';

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

interface SapODataResponse {
  content: string;
  contentType: string;
  url: string;
  isJson: boolean;
  parsedContent?: any;
}

export default function SapODataExplorer() {
  const [activeTab, setActiveTab] = useState<'services' | 'metadata' | 'data'>('services');
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<ODataService[]>([]);
  const [filteredServices, setFilteredServices] = useState<ODataService[]>([]);
  const [searchText, setSearchText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<ODataService | null>(null);
  const [showSettings, setShowSettings] = useState(true);
  const [metadata, setMetadata] = useState<string>('');
  const [serviceData, setServiceData] = useState<any>(null);

  // Connection settings
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>({
    baseUrl: 'https://54.81.18.66:44301',
    username: 'Everest',
    password: 'Welcome1',
    rejectUnauthorized: false,
  });

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

  const fetchServices = async () => {
    if (!connectionInfo.baseUrl.trim() || !connectionInfo.username.trim() || !connectionInfo.password.trim()) {
      setError('Please configure connection settings first');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('http://localhost:3001/sapodata/catalog', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(connectionInfo),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: SapODataResponse = await response.json();
      
      if (result.isJson && result.parsedContent?.d?.results) {
        setServices(result.parsedContent.d.results);
        setFilteredServices(result.parsedContent.d.results);
      } else {
        throw new Error('Invalid response format from SAP system');
      }
    } catch (error) {
      console.error('Error fetching SAP OData services:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async (service: ODataService) => {
    try {
      setLoading(true);
      setError(null);

      const metadataPath  = new URL(service.MetadataUrl).pathname
      
      const response = await fetch('http://localhost:3001/sapodata/metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          servicePath: metadataPath,
          connectionInfo,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: SapODataResponse = await response.json();
      setMetadata(result.content);
      setSelectedService(service);
      setActiveTab('metadata');
    } catch (error) {
      console.error('Error fetching metadata:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch metadata');
    } finally {
      setLoading(false);
    }
  };

  const fetchServiceData = async (service: ODataService) => {
    try {
      setLoading(true);
      setError(null);


      const dataPath  = `${new URL(service.ServiceUrl).pathname}/`;
      
      const response = await fetch('http://localhost:3001/sapodata/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          servicePath: dataPath,
          connectionInfo,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: SapODataResponse = await response.json();
      setServiceData(result.parsedContent);
      setSelectedService(service);
      setActiveTab('data');
    } catch (error) {
      console.error('Error fetching service data:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch service data');
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

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#1e3a8a', color: 'white', padding: '24px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0 0 8px 0' }}>
          SAP OData Services Explorer
        </h1>
        <p style={{ color: '#bfdbfe', margin: 0 }}>
          Explore, analyze and interact with SAP S/4HANA OData services
        </p>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        {/* Connection Settings Card */}
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
                ⚙️ Connection Settings
              </h2>
              <button
                onClick={() => setShowSettings(!showSettings)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'transparent',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                {showSettings ? 'Hide' : 'Show'} Settings
              </button>
            </div>
          </div>
          {showSettings && (
            <div style={{ padding: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                    SAP System URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://your-sap-system:44301"
                    value={connectionInfo.baseUrl}
                    onChange={(e) => setConnectionInfo(prev => ({ ...prev, baseUrl: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                    Username
                  </label>
                  <input
                    type="text"
                    placeholder="SAP Username"
                    value={connectionInfo.username}
                    onChange={(e) => setConnectionInfo(prev => ({ ...prev, username: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                    Password
                  </label>
                  <input
                    type="password"
                    placeholder="SAP Password"
                    value={connectionInfo.password}
                    onChange={(e) => setConnectionInfo(prev => ({ ...prev, password: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="rejectUnauthorized"
                    checked={connectionInfo.rejectUnauthorized}
                    onChange={(e) => setConnectionInfo(prev => ({ ...prev, rejectUnauthorized: e.target.checked }))}
                  />
                  <label htmlFor="rejectUnauthorized" style={{ fontSize: '14px' }}>
                    Validate SSL Certificates
                  </label>
                </div>
              </div>
            </div>
          )}
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
                borderBottom: activeTab === 'services' ? '2px solid #3b82f6' : 'none',
                border: 'none',
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
                borderBottom: activeTab === 'metadata' ? '2px solid #3b82f6' : 'none',
                border: 'none',
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
                borderBottom: activeTab === 'data' ? '2px solid #3b82f6' : 'none',
                border: 'none',
                cursor: selectedService ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: activeTab === 'data' ? '600' : '400',
                color: selectedService ? (activeTab === 'data' ? '#3b82f6' : '#6b7280') : '#d1d5db'
              }}
            >
              📊 Data Explorer
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
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Available Services</h2>
                <button
                  onClick={fetchServices}
                  disabled={loading || !connectionInfo.baseUrl.trim() || !connectionInfo.username.trim() || !connectionInfo.password.trim()}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    opacity: loading ? 0.6 : 1
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
                  <p>Loading services...</p>
                </div>
              ) : services.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚀</div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '8px' }}>
                    Welcome to SAP OData Services Explorer
                  </h3>
                  <p style={{ color: '#6b7280' }}>
                    Configure your SAP system connection and click "Load Services" to discover available OData services.
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
                <div style={{ 
                  backgroundColor: '#f3f4f6', 
                  padding: '16px', 
                  borderRadius: '8px', 
                  overflow: 'auto', 
                  maxHeight: '400px' 
                }}>
                  <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', margin: 0 }}>{metadata}</pre>
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
              ) : (
                <p style={{ color: '#6b7280' }}>No data available</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
