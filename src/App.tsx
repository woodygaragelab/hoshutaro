// src/App.tsx

import React, { useEffect, useState, ChangeEvent, FormEvent } from 'react';
import axios from 'axios';

type Equipment = {
  id: string;
  number: string;
  name: string;
  location: string;
  month01: string;
  month02: string;
  month03: string;
  month04: string;
  month05: string;
  month06: string;
  month07: string;
  month08: string;
  month09: string;
  month10: string;
  month11: string;
  month12: string;
};

// API Gateway のエンドポイントを設定してください
// const API_URL = 'https://qww7m39kui.execute-api.ap-northeast-1.amazonaws.com/idtxls';
const API_URL = 'https://c1w211b5p9.execute-api.ap-northeast-1.amazonaws.com/default/idMaxHoshi';

const App: React.FC = () => {
  const [items, setItems] = useState<Equipment[]>([]);
  const [formData, setFormData] = useState<Omit<Equipment, 'id'>>({
    number: '',
    name: '',
    location: '',
    month01: '',
    month02: '',
    month03: '',
    month04: '',
    month05: '',
    month06: '',
    month07: '',
    month08: '',
    month09: '',
    month10: '',
    month11: '',
    month12: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  // DynamoDB から全データを取得
  const fetchData = async () => {
    try {
      const res = await axios.get<Equipment[]>(API_URL);
      setItems(res.data);
    } catch (err) {
      console.error('データ取得エラー', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // フォーム入力変更ハンドラ
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // 追加・更新処理
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        // 更新
        await axios.put(API_URL, { id: editingId, ...formData });
        setEditingId(null);
      } else {
        // 追加
        await axios.post(API_URL, formData);
      }
      // フォームリセット＆データ再取得
      setFormData({
        number: '',
        name: '',
        location: '',
        month01: '',
        month02: '',
        month03: '',
        month04: '',
        month05: '',
        month06: '',
        month07: '',
        month08: '',
        month09: '',
        month10: '',
        month11: '',
        month12: '',
      });
      fetchData();
    } catch (err) {
      console.error('保存エラー', err);
    }
  };

  // 編集開始
  const startEdit = (item: Equipment) => {
    const { id, ...rest } = item;
    setFormData(rest);
    setEditingId(id);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>設備点検一覧</h2>

      <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <input
            name="number"
            placeholder="設備番号"
            value={formData.number}
            onChange={handleChange}
          />
          <input
            name="name"
            placeholder="設備名"
            value={formData.name}
            onChange={handleChange}
          />
          <input
            name="location"
            placeholder="設置場所"
            value={formData.location}
            onChange={handleChange}
          />
          {Array.from({ length: 12 }, (_, i) => {
            const key = `month${String(i + 1).padStart(2, '0')}`;
            return (
              <input
                key={key}
                name={key}
                placeholder={`${i + 1}月点検結果`}
                value={(formData as any)[key]}
                onChange={handleChange}
                style={{ width: '80px' }}
              />
            );
          })}
          <button type="submit">
            {editingId ? '更新' : '追加'}
          </button>
        </div>
      </form>

      <table border={1} cellPadding={4} cellSpacing={0}>
        <thead>
          <tr>
            <th>設備番号</th>
            <th>設備名</th>
            <th>設置場所</th>
            {Array.from({ length: 12 }, (_, i) => (
              <th key={i}>{i + 1}月</th>
            ))}
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              <td>{item.number}</td>
              <td>{item.name}</td>
              <td>{item.location}</td>
              {Array.from({ length: 12 }, (_, i) => {
                const key = `month${String(i + 1).padStart(2, '0')}` as keyof Equipment;
                return <td key={i}>{item[key]}</td>;
              })}
              <td>
                <button onClick={() => startEdit(item)}>編集</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default App;
