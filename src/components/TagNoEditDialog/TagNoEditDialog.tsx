/**
 * TAG No. Edit Dialog
 * Dialog for editing equipment TAG numbers
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from '@mui/material';

export interface TagNoEditDialogProps {
  open: boolean;
  tagNo: string;
  onSave: (newTagNo: string) => void;
  onClose: () => void;
  readOnly?: boolean;
}

/**
 * TAG No. Edit Dialog Component
 */
const TagNoEditDialog: React.FC<TagNoEditDialogProps> = ({
  open,
  tagNo,
  onSave,
  onClose,
  readOnly = false,
}) => {
  const [value, setValue] = React.useState(tagNo);

  React.useEffect(() => {
    setValue(tagNo);
  }, [tagNo]);

  const handleSave = () => {
    if (!readOnly) {
      onSave(value);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>TAG No. 編集</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="TAG No."
          type="text"
          fullWidth
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={readOnly}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={handleSave} variant="contained" color="primary" disabled={readOnly}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TagNoEditDialog;
