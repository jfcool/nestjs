'use client';

import React, { useState } from 'react';
import { api, ApiError, NetworkError } from '@/lib/api-client';

interface SapCloudSdkResponse {
  data: any;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  url: string;
  timestamp: string;
  source: 'sap-cloud-sdk';
}

interface SapCloudSdkViewerProps {
  onBack: () => void;
}

export default function SapCloudSdkViewer({ onBack }: SapCloudSdkViewerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<SapCloudSdkResponse | null>(null);
  const [destinationName, setDestinationName] = useState<string>('S4HANA_ONPREM');
  const [servicePath, setServicePath] = useState<string>('/sap/opu/odata/sap/API_BUSINESS_PARTNER/$metadata');
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'>('GET');
  const [customHeaders, setCustomHeaders] = useState<string>('{}');
  const [requestBody, setRequestBody] = useState<string>('{}');
  const [sdkHealth, setSdkHealth] = useState<{ status: string; sdkVersion: string; timestamp: string } | null>(null);

  // Check SDK health on component mount
  React.useEffect(() => {
    checkSdkHealth();
  }, []);

  const checkSdkHealth = async () => {
    try {
      const healthResponse = await api.sapOData.cloudSdk.health();
      setSdkHealth(healthResponse.data);
    } catch (error) {
      console.error('Error checking SAP Cloud SDK health:', error);
    }
  };

  const executeRequest = async () => {
    if (!destinationName.trim()) {
      setError('Please enter a destination name');
      return;
    }

    if (!servicePath.trim()) {
      setError('Please enter a service path');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let headers = {};
      let data = undefined;

      // Parse custom headers
      try {
        headers = JSON.parse(customHeaders);
      } catch (e) {
        throw new Error('Invalid JSON in custom headers');
      }

      // Parse request body for POST/PUT/PATCH requests
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        try {
          data = JSON.parse(requestBody);
        } catch (e) {
          throw new Error('Invalid JSON in request body');
        }
      }

      const requestPayload = {
        destinationName,
        servicePath,
        method,
        headers,
        data
      };

      const apiResponse = await api.sapOData.cloudSdk.execute(requestPayload);
      setResponse(apiResponse.data);
    } catch (error) {
      console.error('Error executing SAP Cloud SDK request:', error);
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

  const executeBusinessPartnersExample = async () => {
    if (!destinationName.trim()) {
      setError('Please enter a destination name');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const requestPayload = {
        destinationName,
        servicePath: '/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner?$top=5',
        method: 'GET'
      };

      const apiResponse = await api.sapOData.cloudSdk.execute(requestPayload);
      setResponse(apiResponse.data);
    } catch (error) {
      console.error('Error executing Business Partners example:', error);
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

  const executeMetadataExample = async () => {
    if (!destinationName.trim()) {
      setError('Please enter a destination name');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const requestPayload = {
        destinationName,
        servicePath: '/sap/opu/odata/sap/API_BUSINESS_PARTNER/$metadata',
        method: 'GET'
      };

      const apiResponse = await api.sapOData.cloudSdk.execute(requestPayload);
      setResponse(apiResponse.data);
    } catch (error) {
      console.error('Error executing Metadata example:', error);
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

  return (
    <div style={{ 
      backgroundColor: 'white', 
      borderRadius: '8px', 
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      border: '1px solid #e5e7eb'
    }}>
      <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>☁️ SAP Cloud SDK</h2>
            {sdkHealth && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ 
                  backgroundColor: sdkHealth.status === 'ok' ? '#dcfce7' : '#fef2f2', 
                  color: sdkHealth.status === 'ok' ? '#166534' : '#991b1b', 
                  padding: '4px 8px', 
                  borderRadius: '12px', 
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  {sdkHealth.status === 'ok' ? '✅ SDK Ready' : '❌ SDK Error'}
                </span>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                  v{sdkHealth.sdkVersion}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onBack}
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

        <div style={{ 
          backgroundColor: '#eff6ff', 
          border: '1px solid #bfdbfe', 
          borderRadius: '8px', 
          padding: '12px', 
          marginBottom: '16px' 
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 8px 0', color: '#1e40af' }}>
            🚀 BTP SAP Cloud SDK Integration
          </h3>
          <p style={{ fontSize: '12px', color: '#1e40af', margin: 0, lineHeight: '1.4' }}>
            Dieses Tool nutzt das SAP Cloud SDK mit Ihrer BTP-Konfiguration (local-dev.json). 
            Geben Sie einfach den Destination-Namen und Service-Pfad ein, um API-Calls auszuführen.
          </p>
        </div>

        {/* Destination and Service Configuration */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
              Destination Name
            </label>
            <input
              type="text"
              value={destinationName}
              onChange={(e) => setDestinationName(e.target.value)}
              placeholder="S4HANA_ONPREM"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
              Destination aus Ihrer BTP-Konfiguration
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
              HTTP Method
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as any)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: 'white'
              }}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
            Service Path
          </label>
          <input
            type="text"
            value={servicePath}
            onChange={(e) => setServicePath(e.target.value)}
            placeholder="/sap/opu/odata/sap/API_BUSINESS_PARTNER/$metadata"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
            OData Service Pfad (z.B. /sap/opu/odata/sap/SERVICE_NAME/EntitySet)
          </div>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Quick Examples */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
            🚀 Beispiel-Calls
          </h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={executeMetadataExample}
              disabled={loading || !destinationName.trim()}
              style={{
                padding: '8px 12px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading || !destinationName.trim() ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                opacity: loading || !destinationName.trim() ? 0.6 : 1
              }}
            >
              📋 Metadata abrufen
            </button>
            <button
              onClick={executeBusinessPartnersExample}
              disabled={loading || !destinationName.trim()}
              style={{
                padding: '8px 12px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading || !destinationName.trim() ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                opacity: loading || !destinationName.trim() ? 0.6 : 1
              }}
            >
              👥 Business Partners
            </button>
          </div>
          
          <div style={{ 
            backgroundColor: '#f3f4f6', 
            padding: '12px', 
            borderRadius: '6px', 
            marginTop: '12px',
            fontFamily: 'monospace',
            fontSize: '11px'
          }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{`// Ihr ursprünglicher Code:
import '@sap/xsenv/load';
const dest = await getDestination({ destinationName: '${destinationName}' });
if (!dest) throw new Error('Destination not found');

const req: HttpRequestConfig = {
  method: 'GET',
  url: '${servicePath}'
};

const { data } = await executeHttpRequest(dest, req);
console.log(data);`}</pre>
          </div>
        </div>

        {/* Advanced Request */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
            🔧 Erweiterte Optionen
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                Custom Headers (JSON)
              </label>
              <textarea
                value={customHeaders}
                onChange={(e) => setCustomHeaders(e.target.value)}
                placeholder='{"Accept": "application/json"}'
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  resize: 'vertical'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                Request Body (JSON) - für POST/PUT/PATCH
              </label>
              <textarea
                value={requestBody}
                onChange={(e) => setRequestBody(e.target.value)}
                placeholder='{"key": "value"}'
                rows={3}
                disabled={!['POST', 'PUT', 'PATCH'].includes(method)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  resize: 'vertical',
                  opacity: ['POST', 'PUT', 'PATCH'].includes(method) ? 1 : 0.5
                }}
              />
            </div>
          </div>

          <button
            onClick={executeRequest}
            disabled={loading || !destinationName.trim() || !servicePath.trim()}
            style={{
              padding: '10px 16px',
              backgroundColor: '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading || !destinationName.trim() || !servicePath.trim() ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              opacity: loading || !destinationName.trim() || !servicePath.trim() ? 0.6 : 1
            }}
          >
            {loading ? '⏳ Wird ausgeführt...' : '🚀 Request ausführen'}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div style={{ 
            backgroundColor: '#fef2f2', 
            border: '1px solid #fecaca', 
            borderRadius: '8px', 
            padding: '12px', 
            marginBottom: '16px',
            color: '#991b1b'
          }}>
            <strong>Fehler:</strong> {error}
          </div>
        )}

        {/* Response Display */}
        {response && (
          <div style={{ marginTop: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
              📊 Response
            </h3>
            
            {/* Response Metadata */}
            <div style={{ 
              backgroundColor: '#f9fafb', 
              padding: '12px', 
              borderRadius: '6px', 
              marginBottom: '12px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', fontSize: '12px' }}>
                <div><strong>Status:</strong> {response.status} {response.statusText}</div>
                <div><strong>Source:</strong> {response.source}</div>
                <div><strong>URL:</strong> {response.url}</div>
                <div><strong>Timestamp:</strong> {new Date(response.timestamp).toLocaleString()}</div>
              </div>
            </div>

            {/* Response Headers */}
            {Object.keys(response.headers).length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Headers</h4>
                <div style={{ 
                  backgroundColor: '#f3f4f6', 
                  padding: '12px', 
                  borderRadius: '6px', 
                  fontSize: '12px',
                  fontFamily: 'monospace'
                }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(response.headers, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Response Data */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Data</h4>
              <div style={{ 
                backgroundColor: '#f3f4f6', 
                padding: '12px', 
                borderRadius: '6px', 
                overflow: 'auto', 
                maxHeight: '400px',
                fontSize: '12px',
                fontFamily: 'monospace'
              }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(response.data, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
