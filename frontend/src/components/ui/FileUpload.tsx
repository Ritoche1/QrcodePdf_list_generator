import { useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Upload, File, X } from 'lucide-react';

interface FileUploadProps {
  accept?: string;
  maxSize?: number; // bytes
  onFile: (file: File) => void;
  className?: string;
  label?: string;
  hint?: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload({
  accept,
  maxSize,
  onFile,
  className,
  label = 'Drop a file here or click to upload',
  hint,
}: FileUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setError(null);
    if (maxSize && file.size > maxSize) {
      setError(`File is too large. Max size is ${formatBytes(maxSize)}.`);
      return;
    }
    setSelected(file);
    onFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const clear = () => {
    setSelected(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className={className}>
      {selected ? (
        <div className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl bg-gray-50">
          <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
            <File className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{selected.name}</p>
            <p className="text-xs text-gray-500">{formatBytes(selected.size)}</p>
          </div>
          <button
            onClick={clear}
            className="flex-shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={clsx(
            'flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors',
            dragging
              ? 'border-indigo-400 bg-indigo-50'
              : 'border-gray-300 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50'
          )}
        >
          <div className={clsx(
            'w-12 h-12 flex items-center justify-center rounded-xl transition-colors',
            dragging ? 'bg-indigo-100 text-indigo-500' : 'bg-white text-gray-400 shadow-sm'
          )}>
            <Upload className="w-6 h-6" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">{label}</p>
            {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleChange}
            className="sr-only"
          />
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}
