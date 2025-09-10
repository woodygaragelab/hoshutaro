import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Button
} from '@mui/material';

// App.tsxから受け取るデータの型定義
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

// コンポーネントが受け取るプロパティ(props)の型定義
type Props = {
  items: Equipment[];
  onEdit: (item: Equipment) => void;
};

const EquipmentTable: React.FC<Props> = ({ items, onEdit }) => {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>設備番号</TableCell>
          <TableCell>設備名</TableCell>
          <TableCell>設置場所</TableCell>
          {Array.from({ length: 12 }, (_, i) => (
            <TableCell key={i} sx={{ minWidth: 60 }}>{i + 1}月</TableCell>
          ))}
          <TableCell>操作</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map(item => (
          <TableRow key={item.id}>
            <TableCell>{item.number}</TableCell>
            <TableCell>{item.name}</TableCell>
            <TableCell>{item.location}</TableCell>
            {Array.from({ length: 12 }, (_, i) => {
              const key = `month${String(i + 1).padStart(2, '0')}` as keyof Equipment;
              return <TableCell key={i}>{item[key]}</TableCell>;
            })}
            <TableCell>
              <Button variant="outlined" size="small" onClick={() => onEdit(item)}>編集</Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default EquipmentTable;
