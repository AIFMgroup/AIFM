'use client';

import { useState, useEffect } from 'react';
import { X, FileText, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/Button';

interface DocumentPreviewModalProps {
  document: {
    id: string;
    fileName: string;
    fileType: string;
    storageUrl: string;
    title?: string | null;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DocumentPreviewModal({ document, isOpen, onClose }: DocumentPreviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && document) {
      setLoading(true);
      setError(null);
    }
  }, [isOpen, document]);

  if (!isOpen || !document) return null;

  const isPDF = document.fileType === 'application/pdf';
  const isImage = document.fileType.startsWith('image/');
  const isText = document.fileType === 'text/plain';

  return (
    <div className="fixed inset-0 z-[10000] bg-black bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b-2 border-gray-200">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-black uppercase tracking-wide">
              {document.title || document.fileName}
            </h2>
            <p className="text-sm text-gray-600 mt-1">{document.fileName}</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={document.storageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-gray-100 rounded-2xl transition-colors"
            >
              <ExternalLink className="w-5 h-5 text-gray-600" />
            </a>
            <a
              href={document.storageUrl}
              download
              className="p-2 hover:bg-gray-100 rounded-2xl transition-colors"
            >
              <Download className="w-5 h-5 text-gray-600" />
            </a>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-2xl transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 bg-gray-50">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
                <p className="text-gray-600 uppercase tracking-wide">Loading document...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-red-600 uppercase tracking-wide mb-4">{error}</p>
                <a
                  href={document.storageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Open in new tab →
                </a>
              </div>
            </div>
          )}

          {!loading && !error && (
            <>
              {isPDF && (
                <iframe
                  src={document.storageUrl}
                  className="w-full h-full min-h-[600px] border-0 rounded-2xl"
                  onLoad={() => setLoading(false)}
                  onError={() => {
                    setError('Failed to load PDF');
                    setLoading(false);
                  }}
                />
              )}
              {isImage && (
                <div className="flex items-center justify-center">
                  <img
                    src={document.storageUrl}
                    alt={document.title || document.fileName}
                    className="max-w-full max-h-full rounded-2xl shadow-lg"
                    onLoad={() => setLoading(false)}
                    onError={() => {
                      setError('Failed to load image');
                      setLoading(false);
                    }}
                  />
                </div>
              )}
              {isText && (
                <div className="bg-white rounded-2xl p-6 max-w-4xl mx-auto">
                  <iframe
                    src={document.storageUrl}
                    className="w-full min-h-[600px] border-0"
                    onLoad={() => setLoading(false)}
                    onError={() => {
                      setError('Failed to load text file');
                      setLoading(false);
                    }}
                  />
                </div>
              )}
              {!isPDF && !isImage && !isText && (
                <div className="text-center py-16">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-bold text-black uppercase tracking-wide mb-2">
                    Preview not available
                  </p>
                  <p className="text-gray-600 text-sm uppercase tracking-wide mb-4">
                    This file type cannot be previewed in the browser
                  </p>
                  <a
                    href={document.storageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button className="rounded-2xl uppercase tracking-wide">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open in new tab
                    </Button>
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

