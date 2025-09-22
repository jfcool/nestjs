'use client';

import React, { useState, useEffect } from 'react';
import { api, ApiError, NetworkError } from '@/lib/api-client';

/**
 * SAP OData Entity Sets Explorer Component
 * 
 * Diese Komponente ermöglicht die interaktive Exploration von SAP OData Entity Sets.
 * Sie lädt Metadaten von SAP-Services, parst Entity Sets und bietet eine benutzerfreundliche
 * Oberfläche zur Datenabfrage mit konfigurierbaren OData-Parametern.
 * 
 * Features:
 * - Automatisches Laden und Parsen von SAP OData Metadaten
 * - Anzeige aller Entity Sets mit Properties und Key-Feldern
 * - Erweiterte Suchfunktion mit Multi-Word-Unterstützung
 * - Interaktive Datenabfrage mit OData-Query-Parametern ($top, $skip, $filter, etc.)
 * - Responsive Design mit Hover-Effekten und Loading-States
 * - Cache-Integration für bessere Performance
 * 
 * @author SAP Integration Team
 * @version 1.0.0
 * @since 2025-09-12
 */

interface EntitySet {
  name: string;
  entityType: string;
  properties: Array<{
    name: string;
    type: string;
    nullable: boolean;
  }>;
  keyProperties: string[];
}

interface EntitySetData {
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

interface EntitySetsMetadataResponse {
  entitySets: EntitySet[];
  summary?: any;
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

interface EntitySetsViewerProps {
  serviceName: string;
  connectionId: string;
  onBack: () => void;
}

interface QueryOptions {
  top?: number;
  skip?: number;
  filter?: string;
  orderby?: string;
  select?: string;
  expand?: string;
}

export default function EntitySetsViewer({ serviceName, connectionId, onBack }: EntitySetsViewerProps) {
  const [loading, setLoading] = useState(false);
  const [entitySets, setEntitySets] = useState<EntitySet[]>([]);
  const [filteredEntitySets, setFilteredEntitySets] = useState<EntitySet[]>([]);
  const [entitySetsResponse, setEntitySetsResponse] = useState<EntitySetsMetadataResponse | null>(null);
  const [searchText, setSearchText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedEntitySet, setSelectedEntitySet] = useState<EntitySet | null>(null);
  const [entitySetData, setEntitySetData] = useState<EntitySetData | null>(null);
  const [showDataModal, setShowDataModal] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [queryOptions, setQueryOptions] = useState<QueryOptions>({
    skip: 0
  });

  // Filter entity sets based on search text
  useEffect(() => {
    if (searchText) {
      const searchWords = searchText.toLowerCase().trim().split(/\s+/).filter(word => word.length > 0);
      const filtered = entitySets.filter((entitySet) => {
        const searchableText = [
          entitySet.name,
          entitySet.entityType,
          ...entitySet.properties.map(p => p.name),
          ...entitySet.keyProperties
        ].join(' ').toLowerCase();
        
        return searchWords.every(word => searchableText.includes(word));
      });
      setFilteredEntitySets(filtered);
    } else {
      setFilteredEntitySets(entitySets);
    }
  }, [searchText, entitySets]);

  const fetchEntitySets = async () => {
    try {
      setLoading(true);
      setError(null);

      // First get the parsed metadata to extract entity sets
      const response = await api.sapOData.services.metadataParsed(connectionId, serviceName, {
        cacheConnectionId: undefined // Optional cache connection ID
      });

      const result: EntitySetsMetadataResponse = response.data;
      
      // Store the complete response for cache indicators
      setEntitySetsResponse(result);
      
      if (result.entitySets) {
        setEntitySets(result.entitySets);
        setFilteredEntitySets(result.entitySets);
      } else {
        throw new Error('No entity sets found in metadata');
      }
    } catch (error) {
      console.error('Error fetching entity sets:', error);
      const errorMessage = error instanceof ApiError 
        ? `API Error: ${error.message}` 
        : error instanceof NetworkError 
        ? `Network Error: ${error.message}`
        : error instanceof Error ? error.message : 'Failed to fetch entity sets';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchEntitySetData = async (entitySet: EntitySet) => {
    try {
      setDataLoading(true);
      setError(null);
      setSelectedEntitySet(entitySet);

      const apiResponse = await api.sapOData.services.entitySetData(connectionId, serviceName, entitySet.name, {
        options: queryOptions,
        cacheConnectionId: undefined // Optional cache connection ID
      });

      const result: EntitySetData = apiResponse.data;
      setEntitySetData(result);
      setShowDataModal(true);
    } catch (error) {
      console.error('Error fetching entity set data:', error);
      const errorMessage = error instanceof ApiError 
        ? `API Error: ${error.message}` 
        : error instanceof NetworkError 
        ? `Network Error: ${error.message}`
        : error instanceof Error ? error.message : 'Failed to fetch entity set data';
      setError(errorMessage);
    } finally {
      setDataLoading(false);
    }
  };

  const renderEntitySetCard = (entitySet: EntitySet) => (
    <div
      key={entitySet.name}
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '16px',
        backgroundColor: '#fafafa',
        transition: 'all 0.2s',
        cursor: 'pointer'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
        e.currentTarget.style.backgroundColor = '#f0f9ff';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.backgroundColor = '#fafafa';
      }}
      onClick={() => fetchEntitySetData(entitySet)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ 
            fontSize: '1.125rem', 
            fontWeight: '600', 
            color: '#1e40af', 
            margin: '0 0 8px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            📊 {entitySet.name}
          </h3>
          
          <p style={{ 
            fontSize: '14px', 
            color: '#6b7280', 
            margin: '0 0 12px 0',
            fontFamily: 'monospace'
          }}>
            Type: {entitySet.entityType}
          </p>

          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ 
                backgroundColor: '#dbeafe', 
                color: '#1e40af', 
                padding: '2px 8px', 
                borderRadius: '12px', 
                fontSize: '12px',
                fontWeight: '500'
              }}>
                {entitySet.properties.length} Properties
              </span>
              {entitySet.keyProperties.length > 0 && (
                <span style={{ 
                  backgroundColor: '#fef3c7', 
                  color: '#92400e', 
                  padding: '2px 8px', 
                  borderRadius: '12px', 
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  🔑 {entitySet.keyProperties.length} Keys
                </span>
              )}
            </div>
          </div>

          {/* Key Properties */}
          {entitySet.keyProperties.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <p style={{ fontSize: '12px', fontWeight: '500', color: '#374151', margin: '0 0 4px 0' }}>
                Key Properties:
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {entitySet.keyProperties.map(key => (
                  <span key={key} style={{
                    backgroundColor: '#fbbf24',
                    color: '#92400e',
                    padding: '1px 6px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontFamily: 'monospace'
                  }}>
                    {key}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sample Properties */}
          <div>
            <p style={{ fontSize: '12px', fontWeight: '500', color: '#374151', margin: '0 0 4px 0' }}>
              Properties ({entitySet.properties.length}):
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '60px', overflow: 'hidden' }}>
              {entitySet.properties.slice(0, 8).map(prop => (
                <span key={prop.name} style={{
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  padding: '1px 6px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontFamily: 'monospace'
                }}>
                  {prop.name}
                </span>
              ))}
              {entitySet.properties.length > 8 && (
                <span style={{
                  color: '#6b7280',
                  fontSize: '11px',
                  fontStyle: 'italic'
                }}>
                  +{entitySet.properties.length - 8} more...
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ marginLeft: '16px' }}>
          <button
            disabled={dataLoading}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: dataLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              opacity: dataLoading ? 0.6 : 1
            }}
          >
            {dataLoading && selectedEntitySet?.name === entitySet.name ? '⏳ Loading...' : '📊 View Data'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderDataModal = () => {
    if (!showDataModal || !selectedEntitySet || !entitySetData) return null;

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          width: '90%',
          maxWidth: '1200px',
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Modal Header */}
          <div style={{ 
            padding: '20px', 
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: '0 0 4px 0', color: '#1e40af' }}>
                📊 {selectedEntitySet.name}
              </h2>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                Entity Type: {selectedEntitySet.entityType} • {selectedEntitySet.properties.length} Properties
              </p>
            </div>
            <button
              onClick={() => setShowDataModal(false)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ✕ Close
            </button>
          </div>

          {/* Query Options */}
          <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', marginBottom: '4px' }}>
                  Top (Limit)
                </label>
                <input
                  type="number"
                  value={queryOptions.top || ''}
                  onChange={(e) => setQueryOptions(prev => ({ ...prev, top: parseInt(e.target.value) || undefined }))}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}
                  placeholder="50"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', marginBottom: '4px' }}>
                  Skip (Offset)
                </label>
                <input
                  type="number"
                  value={queryOptions.skip || ''}
                  onChange={(e) => setQueryOptions(prev => ({ ...prev, skip: parseInt(e.target.value) || undefined }))}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}
                  placeholder="0"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', marginBottom: '4px' }}>
                  Filter
                </label>
                <input
                  type="text"
                  value={queryOptions.filter || ''}
                  onChange={(e) => setQueryOptions(prev => ({ ...prev, filter: e.target.value || undefined }))}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}
                  placeholder="Name eq 'Test'"
                />
              </div>
              <div>
                <button
                  onClick={() => fetchEntitySetData(selectedEntitySet)}
                  disabled={dataLoading}
                  style={{
                    marginTop: '18px',
                    padding: '6px 12px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: dataLoading ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    opacity: dataLoading ? 0.6 : 1
                  }}
                >
                  {dataLoading ? '⏳ Loading...' : '🔄 Refresh'}
                </button>
              </div>
            </div>
          </div>

          {/* Modal Content */}
          <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
            {dataLoading ? (
              <div style={{ textAlign: 'center', padding: '48px' }}>
                <div style={{ fontSize: '24px', marginBottom: '16px' }}>⏳</div>
                <p>Loading entity set data...</p>
              </div>
            ) : entitySetData.isJson && entitySetData.parsedContent ? (
              <div>
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
                    {entitySetData.content.length.toLocaleString()} characters
                  </span>
                  {/* Data Source Indicator */}
                  {entitySetData.dataSource === 'cache' ? (
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
                      {entitySetData.cacheInfo?.source && (
                        <span style={{ fontSize: '10px', opacity: 0.8 }}>
                          ({entitySetData.cacheInfo.source})
                        </span>
                      )}
                    </span>
                  ) : entitySetData.dataSource === 'sap' ? (
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
                  {(entitySetData.cacheInfo?.timestamp || entitySetData.sapInfo?.timestamp) && (
                    <span style={{ fontSize: '10px', color: '#9ca3af' }}>
                      Retrieved: {new Date(entitySetData.cacheInfo?.timestamp || entitySetData.sapInfo?.timestamp || '').toLocaleString()}
                    </span>
                  )}
                </div>
                <div style={{ 
                  backgroundColor: '#f3f4f6', 
                  padding: '16px', 
                  borderRadius: '8px', 
                  overflow: 'auto',
                  maxHeight: '400px'
                }}>
                  <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', margin: 0, lineHeight: '1.4' }}>
                    {JSON.stringify(entitySetData.parsedContent, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div style={{ 
                backgroundColor: '#f3f4f6', 
                padding: '16px', 
                borderRadius: '8px', 
                overflow: 'auto',
                maxHeight: '400px'
              }}>
                <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', margin: 0, lineHeight: '1.4' }}>
                  {entitySetData.content}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    fetchEntitySets();
  }, [serviceName, connectionId]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#1e3a8a', color: 'white', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
          <button
            onClick={onBack}
            style={{
              padding: '8px 16px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ← Back to Services
          </button>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
            Entity Sets Explorer
          </h1>
        </div>
        <p style={{ color: '#bfdbfe', margin: 0 }}>
          Service: {serviceName} • Explore entity sets and their data
        </p>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
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

        {/* Controls */}
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '8px', 
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)', 
          marginBottom: '24px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>
                  Available Entity Sets
                </h2>
                {/* EntitySets Metadata Cache Indicator */}
                {entitySetsResponse && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {entitySetsResponse.dataSource === 'cache' ? (
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
                        🗄️ Metadata from Cache
                        {entitySetsResponse.cacheInfo?.source && (
                          <span style={{ fontSize: '10px', opacity: 0.8 }}>
                            ({entitySetsResponse.cacheInfo.source})
                          </span>
                        )}
                      </span>
                    ) : entitySetsResponse.dataSource === 'sap' ? (
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
                        🌐 Metadata from SAP System
                      </span>
                    ) : null}
                    {/* Timestamp */}
                    {(entitySetsResponse.cacheInfo?.timestamp || entitySetsResponse.sapInfo?.timestamp) && (
                      <span style={{ fontSize: '10px', color: '#9ca3af' }}>
                        Retrieved: {new Date(entitySetsResponse.cacheInfo?.timestamp || entitySetsResponse.sapInfo?.timestamp || '').toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={fetchEntitySets}
                disabled={loading}
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
                {loading ? '⏳ Loading...' : (entitySets.length > 0 ? '🔄 Refresh' : '📡 Load Entity Sets')}
              </button>
            </div>

            {entitySets.length > 0 && (
              <div>
                <input
                  type="text"
                  placeholder="🔍 Search entity sets..."
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
                  Showing {filteredEntitySets.length} of {entitySets.length} entity sets
                  {searchText && ` (filtered by "${searchText}")`}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Entity Sets Grid */}
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '8px', 
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ padding: '16px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '48px' }}>
                <div style={{ fontSize: '24px', marginBottom: '16px' }}>⏳</div>
                <p>Loading entity sets...</p>
              </div>
            ) : entitySets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '8px' }}>
                  No Entity Sets Found
                </h3>
                <p style={{ color: '#6b7280' }}>
                  No entity sets were found for this service. Check the service metadata or try refreshing.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                {filteredEntitySets.map(renderEntitySetCard)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Data Modal */}
      {renderDataModal()}
    </div>
  );
}
