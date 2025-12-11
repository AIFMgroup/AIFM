'use client';

import { useState } from 'react';
import { Edit, X, Save } from 'lucide-react';
import { Button } from '@/components/Button';

interface EditableFieldProps {
  label: string;
  value: string | null;
  onSave: (value: string) => Promise<void>;
  multiline?: boolean;
  placeholder?: string;
}

export function EditableField({ label, value, onSave, multiline = false, placeholder }: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value || '');
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div>
        <label className="block text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
          {label}
        </label>
        {multiline ? (
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-2xl focus:outline-none focus:border-black"
            rows={4}
            placeholder={placeholder}
          />
        ) : (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-2xl focus:outline-none focus:border-black"
            placeholder={placeholder}
          />
        )}
        <div className="flex items-center gap-2 mt-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="rounded-2xl uppercase tracking-wide"
          >
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
          <Button
            onClick={handleCancel}
            variant="outline"
            size="sm"
            className="rounded-2xl uppercase tracking-wide"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-1">{label}</p>
          <p className="text-black">{value || <span className="text-gray-400 italic">No {label.toLowerCase()}</span>}</p>
        </div>
        <button
          onClick={() => setIsEditing(true)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded-lg"
        >
          <Edit className="w-4 h-4 text-gray-600" />
        </button>
      </div>
    </div>
  );
}

