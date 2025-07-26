import React, { useState } from 'react';

const App: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.xlsx')) {
      setSelectedFile(file);
      setStatus('');
      setDownloadUrl(null);
    } else {
      setStatus('⚠️ 有効な .xlsx ファイルを選択してください');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setStatus('⚠️ ファイルを選択してください');
      return;
    }

    setStatus('📤 アップロード中...');
    setDownloadUrl(null);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const response = await fetch('https://k2z7y870dd.execute-api.ap-northeast-1.amazonaws.com/default', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: arrayBuffer,
      });

      if (!response.ok) {
        throw new Error(`サーバーエラー: ${response.status}`);
      }

      const contentType = response.headers.get('Content-Type');
      const isBinary = contentType?.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

      const blob = await response.blob();

      if (isBinary) {
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
        setStatus('✅ 修正済みファイルを受信しました');
      } else {
        const text = await blob.text();
        setStatus(`⚠️ 想定外のレスポンス：${text}`);
      }
    } catch (err: any) {
      setStatus(`❌ エラー：${err.message}`);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>Excel ファイル修正 API テスト</h2>

      <input type="file" accept=".xlsx" onChange={handleFileChange} />
      <br /><br />

      <button onClick={handleUpload} disabled={!selectedFile}>
        ファイルをアップロード
      </button>

      <p>{status}</p>

      {downloadUrl && (
        <a href={downloadUrl} download="corrected.xlsx">
          <button>修正済みファイルをダウンロード</button>
        </a>
      )}
    </div>
  );
};

export default App;
