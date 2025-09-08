'use client';

import React, { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridReadyEvent, GridApi, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { cn } from '@/lib/utils';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface DataTableProps<T = any> {
  data: T[];
  columns: ColDef<T>[];
  loading?: boolean;
  pagination?: boolean;
  paginationPageSize?: number;
  onGridReady?: (event: GridReadyEvent) => void;
  className?: string;
  height?: string | number;
}

export function DataTable<T = any>({
  data,
  columns,
  loading = false,
  pagination = true,
  paginationPageSize = 50,
  onGridReady,
  className = '',
  height = 600,
}: DataTableProps<T>) {
  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    flex: 1,
    cellStyle: {
      display: 'flex',
      alignItems: 'center',
      paddingTop: '12px',
      paddingBottom: '12px',
      paddingLeft: '16px',
      paddingRight: '16px',
    },
  }), []);

  const gridOptions = useMemo(() => ({
    animateRows: true,
    enableCellTextSelection: true,
    rowSelection: {
      mode: 'singleRow' as const,
      enableClickSelection: false,
    },
    pagination,
    paginationPageSize,
    paginationPageSizeSelector: [25, 50, 100, 200],
    suppressPaginationPanel: false,
    suppressScrollOnNewData: true,
    getRowId: (params: any) => params.data.id?.toString() || Math.random().toString(),
    rowHeight: 60, // Increased row height for better spacing
    headerHeight: 48, // Increased header height
    theme: 'legacy', // Use legacy theme to avoid theming conflicts
  }), [pagination, paginationPageSize]);

  return (
    <div 
      className={cn(
        "ag-theme-alpine",
        // Custom Tailwind classes for better spacing
        "[&_.ag-row]:min-h-[60px]",
        "[&_.ag-cell]:!flex [&_.ag-cell]:!items-center [&_.ag-cell]:!py-3 [&_.ag-cell]:!px-4",
        "[&_.ag-header-cell]:!flex [&_.ag-header-cell]:!items-center [&_.ag-header-cell]:!py-3 [&_.ag-header-cell]:!px-4",
        "[&_.ag-header-cell]:!h-12",
        "[&_.ag-cell-wrapper]:!flex [&_.ag-cell-wrapper]:!items-center [&_.ag-cell-wrapper]:!h-full",
        // Ensure proper text alignment and overflow handling
        "[&_.ag-cell]:!overflow-visible",
        "[&_.ag-header-cell]:!overflow-visible",
        className
      )}
      style={{ height: typeof height === 'number' ? `${height}px` : height, width: '100%' }}
    >
      <AgGridReact
        rowData={data}
        columnDefs={columns}
        defaultColDef={defaultColDef}
        gridOptions={gridOptions}
        onGridReady={onGridReady}
        loading={loading}
        loadingOverlayComponent={() => (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}
        noRowsOverlayComponent={() => (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <div className="text-4xl mb-4">📊</div>
            <div className="text-lg font-medium mb-2">Keine Daten verfügbar</div>
            <div className="text-sm">Es wurden keine Einträge gefunden.</div>
          </div>
        )}
      />
    </div>
  );
}
