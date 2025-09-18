import { Injectable, Logger } from '@nestjs/common';

export interface SAPTableSchema {
  tableName: string;
  keyFields: string[];
  dateFields: string[];
  amountFields: string[];
  currencyField?: string;
  typeField?: string;
  descriptionField?: string;
  displayTemplate: string;
}

@Injectable()
export class GenericSAPFormatterService {
  private readonly logger = new Logger(GenericSAPFormatterService.name);
  
  private readonly tableSchemas: Map<string, SAPTableSchema> = new Map([
    ['VBAK', {
      tableName: 'VBAK',
      keyFields: ['VBELN'],
      dateFields: ['ERDAT'],
      amountFields: ['NETWR'],
      currencyField: 'WAERK',
      typeField: 'AUART',
      descriptionField: 'VBELN',
      displayTemplate: '{index}. {VBELN} - {typeDescription} ({AUART}) vom {ERDAT}, Wert: {NETWR} {WAERK}'
    }],
    ['VBRK', {
      tableName: 'VBRK',
      keyFields: ['VBELN'],
      dateFields: ['FKDAT'],
      amountFields: ['NETWR'],
      currencyField: 'WAERK',
      typeField: 'FKART',
      descriptionField: 'VBELN',
      displayTemplate: '{index}. {VBELN} - {typeDescription} ({FKART}) vom {FKDAT}, Wert: {NETWR} {WAERK}'
    }],
    ['KNA1', {
      tableName: 'KNA1',
      keyFields: ['KUNNR'],
      dateFields: ['ERDAT'],
      amountFields: [],
      typeField: 'KTOKD',
      descriptionField: 'NAME1',
      displayTemplate: '{index}. {KUNNR} - {NAME1} ({KTOKD})'
    }],
    ['MARA', {
      tableName: 'MARA',
      keyFields: ['MATNR'],
      dateFields: ['ERSDA'],
      amountFields: [],
      typeField: 'MTART',
      descriptionField: 'MAKTX',
      displayTemplate: '{index}. {MATNR} - {MAKTX} ({MTART})'
    }]
  ]);

  private readonly typeTranslations = new Map([
    ['AUART', {
      'TA': 'Standardauftrag',
      'RK': 'Reklamation',
      'AG': 'Vertrag',
      'VC01': 'Vertrag',
      'OR': 'Auftrag',
      'QT': 'Angebot'
    }],
    ['FKART', {
      'F1': 'Kundenrechnung',
      'F2': 'Debitorische Rechnung',
      'F5': 'Pro-forma-Rechnung',
      'F8': 'Sammelrechnung',
      'G2': 'Gutschrift',
      'L2': 'Lieferantengutschrift',
      'RE': 'Rechnung',
      'RK': 'Rechnungskorrektur',
      'S1': 'Stornierung',
      'S2': 'Storno-Gutschrift'
    }],
    ['KTOKD', {
      'KUNA': 'Kunde Inland',
      'KUNB': 'Kunde Ausland',
      'KUNC': 'Einmalkunde'
    }],
    ['MTART', {
      'FERT': 'Fertigerzeugnis',
      'HALB': 'Halbfabrikat',
      'ROH': 'Rohstoff',
      'HIBE': 'Hilfsbetriebsstoff'
    }]
  ]);

  /**
   * Format SAP table data generically based on table schema
   */
  formatSAPTableData(
    tableName: string,
    data: any[],
    toolCall: any
  ): string {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return `Die SAP-Tabelle ${tableName} wurde erfolgreich abgerufen, enthält aber keine Daten.`;
    }

    const schema = this.tableSchemas.get(tableName.toUpperCase());
    
    if (!schema) {
      // Generic fallback for unknown tables
      return this.formatGenericTable(tableName, data);
    }

    let responseContent = `Ja, ich kann jetzt die ersten ${data.length} Einträge aus der ${tableName}-Tabelle Ihres SAP-Systems anzeigen:\n\n`;

    data.forEach((row: any, index: number) => {
      const formattedRow = this.formatTableRow(row, schema, index + 1);
      responseContent += formattedRow + '\n';
    });

    // Add summary based on table type
    const summary = this.generateTableSummary(tableName, data, schema);
    if (summary) {
      responseContent += '\n' + summary;
    }

    return responseContent;
  }

  private formatTableRow(row: any, schema: SAPTableSchema, index: number): string {
    let formattedRow = schema.displayTemplate;

    // Replace index
    formattedRow = formattedRow.replace('{index}', index.toString());

    // Replace all field placeholders
    Object.keys(row).forEach(field => {
      const value = row[field];
      let formattedValue = value;

      // Format dates
      if (schema.dateFields.includes(field) && value) {
        formattedValue = this.formatSAPDate(value);
      }

      // Format amounts
      if (schema.amountFields.includes(field) && value) {
        formattedValue = parseFloat(value).toLocaleString('de-DE', { minimumFractionDigits: 2 });
      }

      // Replace field placeholder
      formattedRow = formattedRow.replace(`{${field}}`, formattedValue);
    });

    // Handle type descriptions
    if (schema.typeField && row[schema.typeField]) {
      const typeValue = row[schema.typeField];
      const typeTranslation = this.typeTranslations.get(schema.typeField);
      const typeDescription = typeTranslation?.[typeValue] || typeValue;
      formattedRow = formattedRow.replace('{typeDescription}', typeDescription);
    }

    // Clean up any remaining placeholders
    formattedRow = formattedRow.replace(/\{[^}]+\}/g, '');

    return formattedRow;
  }

  private formatGenericTable(tableName: string, data: any[]): string {
    let responseContent = `Die SAP-Tabelle ${tableName} wurde erfolgreich abgerufen:\n\n`;

    data.forEach((row: any, index: number) => {
      responseContent += `${index + 1}. ${JSON.stringify(row)}\n`;
    });

    return responseContent;
  }

  private generateTableSummary(tableName: string, data: any[], schema: SAPTableSchema): string {
    const currency = data[0]?.[schema.currencyField || ''] || 'EUR';
    
    switch (tableName.toUpperCase()) {
      case 'VBAK':
        return `Die Belege enthalten verschiedene Auftragsarten mit unterschiedlichen Nettowerten in ${currency}.`;
      case 'VBRK':
        return `Die Rechnungen enthalten verschiedene Rechnungsarten mit unterschiedlichen Nettowerten in ${currency}.`;
      case 'KNA1':
        return `Die Kundenstammdaten enthalten verschiedene Kundenarten und Geschäftspartner.`;
      case 'MARA':
        return `Die Materialstammdaten enthalten verschiedene Materialarten und Produkte.`;
      default:
        return `Die Tabelle enthält ${data.length} Einträge mit verschiedenen Datentypen.`;
    }
  }

  private formatSAPDate(sapDate: string): string {
    if (!sapDate || sapDate.length !== 8) return sapDate;
    
    const year = sapDate.substring(0, 4);
    const month = sapDate.substring(4, 6);
    const day = sapDate.substring(6, 8);
    
    return `${day}.${month}.${year}`;
  }

  /**
   * Add new table schema dynamically
   */
  addTableSchema(tableName: string, schema: SAPTableSchema): void {
    this.tableSchemas.set(tableName.toUpperCase(), schema);
    this.logger.log(`Added schema for table: ${tableName}`);
  }

  /**
   * Add new type translations
   */
  addTypeTranslations(fieldName: string, translations: any): void {
    this.typeTranslations.set(fieldName, translations);
    this.logger.log(`Added type translations for field: ${fieldName}`);
  }

  /**
   * Get supported tables
   */
  getSupportedTables(): string[] {
    return Array.from(this.tableSchemas.keys());
  }

  /**
   * Check if table is supported
   */
  isTableSupported(tableName: string): boolean {
    return this.tableSchemas.has(tableName.toUpperCase());
  }
}
