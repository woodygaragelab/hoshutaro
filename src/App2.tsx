import React, { useState, useEffect } from 'react';

const App2: React.FC = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState<string | null>(null);
  const APIURL = 'https://c1w211b5p9.execute-api.ap-northeast-1.amazonaws.com/default/idMaxHoshi'

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 設備データを取得するサンプルAPI
        const response = await fetch(APIURL);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const json = await response.json();
        setData(json);
      } catch (e) {
        if (e instanceof Error) {
          setError(e.message);
        } else {
          setError('An unknown error occurred');
        }
      }
    };

    fetchData();
  }, []);

  return (
    <div>
      <h1>App2　（APIを呼んでBackend DBから設備データを取得するサンプル）</h1>
      <p>API(Lambda)のURL: {APIURL}</p>
      <p>APIからのレスポンス:</p>
      {error && <p>エラー: {error}</p>}
      <pre>{data ? JSON.stringify(data, null, 2) : 'Loading...'}</pre>
    </div>
  );
};

export default App2;