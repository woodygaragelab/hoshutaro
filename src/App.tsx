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

      // 最初のシート名を取得
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      // シートをJSONに変換
      const jsonData: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      setExcelData(jsonData);
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>Excel アップロード &rarr; JSON表示</h2>
      <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} />

      {excelData && (
        <div style={{ marginTop: '20px' }}>
          <h3>変換されたJSONデータ:</h3>
          <pre style={{ background: '#f0f0f0', padding: '10px', overflowX: 'auto' }}>
            {JSON.stringify(excelData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default App;
