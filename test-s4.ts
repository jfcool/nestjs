// test-s4.ts - Test script for SAP Cloud SDK integration
import '@sap/xsenv/load';
import { getDestination } from '@sap-cloud-sdk/connectivity';
import { executeHttpRequest, HttpRequestConfig } from '@sap-cloud-sdk/http-client';

async function main() {
  try {
    console.log('🚀 Starting SAP Cloud SDK test...');
    
    // 1) Destination auflösen
    console.log('📡 Resolving destination: S4HANA_ONPREM');
    const dest = await getDestination({ destinationName: 'S4HANA_ONPREM' });
    if (!dest) throw new Error('Destination not found');

    console.log('✅ Destination resolved:', {
      name: dest.name,
      proxyType: dest.proxyType,
      url: dest.url,
    });

    // 2) Metadata Call (leichter Test)
    console.log('📋 Testing metadata call...');
    const metadataReq: HttpRequestConfig = {
      method: 'GET',
      url: '/sap/opu/odata/sap/API_BUSINESS_PARTNER/$metadata?$format=json'
    };
    
    const metadataResponse = await executeHttpRequest(dest, metadataReq);
    console.log('✅ Metadata call successful:', {
      status: metadataResponse.status,
      contentType: metadataResponse.headers?.['content-type'],
      dataLength: typeof metadataResponse.data === 'string' 
        ? metadataResponse.data.length 
        : JSON.stringify(metadataResponse.data).length
    });

    // 3) Business Partners Call (Ihr ursprüngliches Beispiel)
    console.log('👥 Testing Business Partners call...');
    const businessPartnersReq: HttpRequestConfig = {
      method: 'GET',
      url: '/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner?$top=5'
    };
    
    const businessPartnersResponse = await executeHttpRequest(dest, businessPartnersReq);
    console.log('✅ Business Partners call successful:', {
      status: businessPartnersResponse.status,
      recordCount: businessPartnersResponse.data?.d?.results?.length || 'unknown'
    });

    // Show first record if available
    if (businessPartnersResponse.data?.d?.results?.[0]) {
      const firstRecord = businessPartnersResponse.data.d.results[0];
      console.log('📄 First Business Partner:', {
        BusinessPartner: firstRecord.BusinessPartner,
        BusinessPartnerName: firstRecord.BusinessPartnerName,
        BusinessPartnerCategory: firstRecord.BusinessPartnerCategory
      });
    }

    console.log('🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    process.exit(1);
  }
}

// Run the test
main().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});
