import React, { ChangeEvent, FormEvent } from 'react';
import { Box, TextField } from '@mui/material';

// 親コンポーネントから渡されるフォームデータの型
// Omit<Equipment, 'id'> と同等
type FormData = {
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
    formData: FormData;
    onFormChange: (e: ChangeEvent<HTMLInputElement>) => void;
    onFormSubmit: (e: FormEvent) => void;
};

const EquipmentForm: React.FC<Props> = ({ formData, onFormChange, onFormSubmit }) => {
    return (
        // pt:1 を追加して、ダイアログ上部のスペースを調整
        <Box component="form" onSubmit={onFormSubmit} sx={{ pt: 1 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                <TextField
                    name="number"
                    label="設備番号"
                    variant="outlined"
                    size="small"
                    value={formData.number}
                    onChange={onFormChange}
                />
                <TextField
                    name="name"
                    label="設備名"
                    variant="outlined"
                    size="small"
                    value={formData.name}
                    onChange={onFormChange}
                />
                <TextField
                    name="location"
                    label="設置場所"
                    variant="outlined"
                    size="small"
                    value={formData.location}
                    onChange={onFormChange}
                />
                {Array.from({ length: 12 }, (_, i) => {
                    const key = `month${String(i + 1).padStart(2, '0')}`;
                    return (
                        <TextField
                            key={key}
                            name={key}
                            label={`${i + 1}月`}
                            variant="outlined"
                            size="small"
                            value={(formData as any)[key]}
                            onChange={onFormChange}
                            sx={{ width: 80 }}
                        />
                    );
                })}
            </Box>
        </Box>
    );
};

export default EquipmentForm;