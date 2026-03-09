import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Progress, Typography, Space, message } from 'antd';
import {
  UploadOutlined,
  DeleteOutlined,
  VideoCameraOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import { requestUpload, completeUpload, getAccessUrl } from '../api/uploads';
import { brand } from '../theme/themeConfig';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VideoUploadProps {
  /** Current mediaId (controlled by Ant Design Form.Item) */
  value?: string;
  /** Callback when mediaId changes (controlled by Ant Design Form.Item) */
  onChange?: (mediaId: string | undefined) => void;
  /** Disable interaction */
  disabled?: boolean;
}

type UploadState = 'empty' | 'uploading' | 'complete' | 'error';

interface UploadedFileInfo {
  name: string;
  size: number;
  type: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime'];
const MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VideoUpload({ value, onChange, disabled }: VideoUploadProps) {
  const [state, setState] = useState<UploadState>(value ? 'complete' : 'empty');
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<UploadedFileInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  // Load existing video URL when value (mediaId) is set on mount (edit mode)
  useEffect(() => {
    if (!value) {
      setState('empty');
      setVideoUrl(null);
      setFileInfo(null);
      return;
    }

    // Fetch signed access URL for existing media
    let cancelled = false;
    getAccessUrl(value)
      .then((res) => {
        if (!cancelled) {
          setVideoUrl(res.accessUrl);
          setState('complete');
        }
      })
      .catch(() => {
        if (!cancelled) {
          // If we can't load the URL, still show as complete (ID is valid)
          setState('complete');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [value]);

  const handleFileSelect = useCallback(
    async (file: File) => {
      // Client-side validation
      if (!ACCEPTED_TYPES.includes(file.type)) {
        message.error('Only MP4 and MOV video files are supported.');
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        message.error('Video must be under 500 MB.');
        return;
      }

      setState('uploading');
      setProgress(0);
      setErrorMsg(null);
      setFileInfo({ name: file.name, size: file.size, type: file.type });

      try {
        // Step 1: Request pre-signed URL from backend
        const uploadRes = await requestUpload({
          purpose: 'exercise_media',
          contentType: file.type,
          sizeBytes: file.size,
        });

        // Step 2: PUT file to S3 via pre-signed URL (XHR for progress tracking)
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhrRef.current = xhr;

          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              setProgress(Math.round((e.loaded / e.total) * 100));
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          });

          xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
          xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

          xhr.open('PUT', uploadRes.uploadUrl);
          xhr.setRequestHeader('Content-Type', file.type);
          xhr.send(file);
        });

        // Step 3: Mark upload as complete in backend
        await completeUpload(uploadRes.uploadId);

        // Success — update form value
        setVideoUrl(uploadRes.uploadUrl);
        setState('complete');
        onChange?.(uploadRes.uploadId);

        // Fetch the signed access URL for video preview
        try {
          const accessRes = await getAccessUrl(uploadRes.uploadId);
          setVideoUrl(accessRes.accessUrl);
        } catch {
          // Preview not available but upload succeeded
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed. Please try again.';
        if (msg !== 'Upload cancelled') {
          setErrorMsg(msg);
          setState('error');
        } else {
          setState('empty');
        }
      } finally {
        xhrRef.current = null;
      }
    },
    [onChange],
  );

  const handleCancel = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setState('empty');
    setProgress(0);
    setFileInfo(null);
  }, []);

  const handleRemove = useCallback(() => {
    setState('empty');
    setVideoUrl(null);
    setFileInfo(null);
    setProgress(0);
    onChange?.(undefined);
  }, [onChange]);

  const handleRetry = useCallback(() => {
    setState('empty');
    setErrorMsg(null);
    setProgress(0);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
      // Reset input so the same file can be re-selected
      e.target.value = '';
    },
    [handleFileSelect],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [disabled, handleFileSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Hidden file input
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="video/mp4,video/quicktime,.mp4,.mov"
      style={{ display: 'none' }}
      onChange={handleInputChange}
      data-testid="video-file-input"
    />
  );

  // -------------------------------------------------------------------------
  // Render states
  // -------------------------------------------------------------------------

  if (state === 'uploading') {
    return (
      <div
        style={{
          border: '1px solid #d9d9d9',
          borderRadius: 8,
          padding: 24,
          textAlign: 'center',
        }}
      >
        {fileInput}
        <CloudUploadOutlined style={{ fontSize: 32, color: brand.teal, marginBottom: 8 }} />
        <Typography.Text style={{ display: 'block', marginBottom: 12 }}>
          Uploading {fileInfo?.name ?? 'video'}...
        </Typography.Text>
        <Progress percent={progress} status="active" style={{ maxWidth: 300, margin: '0 auto' }} />
        <div style={{ marginTop: 12 }}>
          <Button size="small" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (state === 'complete') {
    return (
      <div
        style={{
          border: '1px solid #d9d9d9',
          borderRadius: 8,
          padding: 16,
        }}
      >
        {fileInput}
        {videoUrl ? (
          <video
            src={videoUrl}
            controls
            style={{
              width: '100%',
              maxWidth: 480,
              maxHeight: 270,
              borderRadius: 4,
              backgroundColor: '#000',
              display: 'block',
              marginBottom: 12,
            }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
            }}
          >
            <VideoCameraOutlined style={{ fontSize: 24, color: brand.teal }} />
            <Typography.Text>Video uploaded</Typography.Text>
          </div>
        )}
        {fileInfo && (
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            {fileInfo.name} ({formatFileSize(fileInfo.size)})
          </Typography.Text>
        )}
        <Space>
          <Button
            icon={<UploadOutlined />}
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            size="small"
          >
            Replace
          </Button>
          <Button
            icon={<DeleteOutlined />}
            onClick={handleRemove}
            disabled={disabled}
            danger
            size="small"
          >
            Remove
          </Button>
        </Space>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div
        style={{
          border: '1px dashed #ff4d4f',
          borderRadius: 8,
          padding: 24,
          textAlign: 'center',
          backgroundColor: '#fff2f0',
        }}
      >
        {fileInput}
        <Typography.Text type="danger" style={{ display: 'block', marginBottom: 12 }}>
          {errorMsg || 'Upload failed. Please try again.'}
        </Typography.Text>
        <Button onClick={handleRetry}>Try Again</Button>
      </div>
    );
  }

  // Default: empty state
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !disabled && fileInputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
          fileInputRef.current?.click();
        }
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      style={{
        border: '2px dashed #d9d9d9',
        borderRadius: 8,
        padding: 32,
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'border-color 0.2s',
      }}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLElement).style.borderColor = brand.teal;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = '#d9d9d9';
      }}
    >
      {fileInput}
      <UploadOutlined style={{ fontSize: 32, color: '#999', marginBottom: 8 }} />
      <Typography.Text style={{ display: 'block', marginBottom: 4 }}>
        Click or drag video to upload
      </Typography.Text>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        MP4 or MOV, max 500 MB
      </Typography.Text>
    </div>
  );
}
