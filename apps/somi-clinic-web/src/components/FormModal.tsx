import React from 'react';
import { Modal } from 'antd';

interface FormModalProps {
  title: string;
  open: boolean;
  onCancel: () => void;
  onOk: () => void;
  okText?: string;
  confirmLoading?: boolean;
  children: React.ReactNode;
}

/**
 * Opinionated modal wrapper for form dialogs throughout the SOMI clinic app.
 *
 * Enforces `destroyOnHidden` so that form state (validation errors, dirty
 * values) is always reset when the dialog is closed — preventing stale data
 * from leaking into subsequent opens.
 */
export default function FormModal({
  title,
  open,
  onCancel,
  onOk,
  okText = 'Save',
  confirmLoading = false,
  children,
}: FormModalProps) {
  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      okText={okText}
      confirmLoading={confirmLoading}
      destroyOnHidden
    >
      {children}
    </Modal>
  );
}
