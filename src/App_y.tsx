// App.tsx

import React, { useState, ChangeEvent } from 'react';
import * as XLSX from 'xlsx';

interface ExcelRow {
  [key: string]: string | number | boolean | null;
}

const App: React.FC = () => {
  const [excelData, setExcelData] = useState<ExcelRow[] | null>(null);

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      const jsonData: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      setExcelData(jsonData);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleDownload = () => {
    if (!excelData) return;

    const json = JSON.stringify(excelData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.json';
    a.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>Excel アップロード → JSON表示＆ダウンロード</h2>
      <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} />

      {excelData && (
        <div style={{ marginTop: '20px' }}>
          <h3>変換されたJSONデータ:</h3>
          <pre style={{ background: '#f0f0f0', padding: '10px', overflowX: 'auto' }}>
            {JSON.stringify(excelData, null, 2)}
          </pre>
          <button
            onClick={handleDownload}
            style={{
              marginTop: '10px',
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            JSONをダウンロード
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
