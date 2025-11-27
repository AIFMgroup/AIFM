'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Button } from '@/components/Button';
import { FileText, Plus, Edit, Trash2, X, Save, ExternalLink } from 'lucide-react';
import { successToast, errorToast } from '@/lib/toast';

interface Regulation {
  id: string;
  name: string;
  authority: string;
  category: string;
  content?: string | null;
  externalUrl?: string | null;
  effectiveDate?: string | null;
  updatedDate?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function RegulationsPage() {
  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRegulation, setEditingRegulation] = useState<Regulation | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    authority: 'FI',
    category: 'AML',
    content: '',
    externalUrl: '',
    effectiveDate: '',
    updatedDate: '',
    isActive: true,
  });

  useEffect(() => {
    loadRegulations();
  }, []);

  const loadRegulations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/regulations');
      if (!response.ok) throw new Error('Failed to load regulations');
      const data = await response.json();
      setRegulations(data.regulations || []);
    } catch (error) {
      console.error('Failed to load regulations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/regulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          effectiveDate: formData.effectiveDate || null,
          updatedDate: formData.updatedDate || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to save regulation');

      await loadRegulations();
      resetForm();
      successToast(editingRegulation ? 'Regulation updated successfully' : 'Regulation created successfully');
    } catch (error: any) {
      console.error('Failed to save regulation:', error);
      errorToast(`Failed to save regulation: ${error.message}`);
    }
  };

  const handleEdit = (regulation: Regulation) => {
    setEditingRegulation(regulation);
    setFormData({
      name: regulation.name,
      authority: regulation.authority,
      category: regulation.category,
      content: regulation.content || '',
      externalUrl: regulation.externalUrl || '',
      effectiveDate: regulation.effectiveDate ? new Date(regulation.effectiveDate).toISOString().split('T')[0] : '',
      updatedDate: regulation.updatedDate ? new Date(regulation.updatedDate).toISOString().split('T')[0] : '',
      isActive: regulation.isActive,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this regulation?')) return;

    try {
      const response = await fetch(`/api/regulations/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete regulation');

      await loadRegulations();
      successToast('Regulation deleted successfully');
    } catch (error) {
      console.error('Failed to delete regulation:', error);
      errorToast('Failed to delete regulation');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      authority: 'FI',
      category: 'AML',
      content: '',
      externalUrl: '',
      effectiveDate: '',
      updatedDate: '',
      isActive: true,
    });
    setEditingRegulation(null);
    setShowForm(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="page-container py-8">
          <div className="animate-pulse text-gray-500 uppercase tracking-wide">Laddar regelverk...</div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="page-container py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-black mb-2 tracking-tight">REGULATIONS</h1>
            <p className="text-gray-600 text-sm uppercase tracking-wide">Manage regulatory requirements and laws</p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="rounded-2xl uppercase tracking-wide"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Regulation
          </Button>
        </div>

        {/* Form */}
        {showForm && (
          <Card className="border-2 border-gray-200 bg-white mb-8 rounded-3xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl uppercase tracking-wide">
                  {editingRegulation ? 'Edit Regulation' : 'Create New Regulation'}
                </CardTitle>
                <button
                  onClick={resetForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold uppercase tracking-wide mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-2xl focus:outline-none focus:border-black"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold uppercase tracking-wide mb-2">
                      Authority *
                    </label>
                    <select
                      value={formData.authority}
                      onChange={(e) => setFormData({ ...formData, authority: e.target.value })}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-2xl focus:outline-none focus:border-black"
                    >
                      <option value="FI">FI (Finansinspektionen)</option>
                      <option value="SKV">SKV (Skatteverket)</option>
                      <option value="EU">EU</option>
                      <option value="SEC">SEC</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold uppercase tracking-wide mb-2">
                      Category *
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-2xl focus:outline-none focus:border-black"
                    >
                      <option value="AML">AML (Anti-Money Laundering)</option>
                      <option value="KYC">KYC (Know Your Customer)</option>
                      <option value="tax">Tax</option>
                      <option value="data_protection">Data Protection</option>
                      <option value="financial">Financial</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold uppercase tracking-wide mb-2">
                    Content
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={8}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-2xl focus:outline-none focus:border-black"
                    placeholder="Full text or summary of the regulation..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold uppercase tracking-wide mb-2">
                    External URL
                  </label>
                  <input
                    type="url"
                    value={formData.externalUrl}
                    onChange={(e) => setFormData({ ...formData, externalUrl: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-2xl focus:outline-none focus:border-black"
                    placeholder="https://..."
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold uppercase tracking-wide mb-2">
                      Effective Date
                    </label>
                    <input
                      type="date"
                      value={formData.effectiveDate}
                      onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-2xl focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold uppercase tracking-wide mb-2">
                      Updated Date
                    </label>
                    <input
                      type="date"
                      value={formData.updatedDate}
                      onChange={(e) => setFormData({ ...formData, updatedDate: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-2xl focus:outline-none focus:border-black"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="isActive" className="text-sm font-semibold uppercase tracking-wide">
                    Active
                  </label>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" className="rounded-2xl uppercase tracking-wide">
                    <Save className="w-4 h-4 mr-2" />
                    {editingRegulation ? 'Update' : 'Create'} Regulation
                  </Button>
                  <Button type="button" onClick={resetForm} variant="outline" className="rounded-2xl uppercase tracking-wide">
                    Avbryt
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Regulations List */}
        <div>
          <h2 className="text-2xl font-bold mb-4 uppercase tracking-wide">All Regulations</h2>
          {regulations.length === 0 ? (
            <Card className="border-2 border-dashed border-gray-300 bg-white rounded-3xl">
              <CardContent className="text-center py-16">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-bold text-black uppercase tracking-wide mb-2">No Regulations</p>
                <p className="text-gray-600 text-sm uppercase tracking-wide">
                  Click "New Regulation" to add your first regulation
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {regulations.map((regulation) => (
                <Card key={regulation.id} className="border-2 border-gray-200 bg-white hover:shadow-lg transition-all duration-200 rounded-3xl">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg font-bold text-black mb-1">
                          {regulation.name}
                        </CardTitle>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs font-semibold bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                            {regulation.authority}
                          </span>
                          <span className="text-xs font-semibold bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                            {regulation.category}
                          </span>
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            regulation.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {regulation.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        {regulation.content && (
                          <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                            {regulation.content}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {regulation.externalUrl && (
                          <a
                            href={regulation.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-600 hover:text-gray-800"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <Button
                          onClick={() => handleEdit(regulation)}
                          variant="outline"
                          size="sm"
                          className="rounded-2xl"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => handleDelete(regulation.id)}
                          variant="outline"
                          size="sm"
                          className="rounded-2xl text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {regulation.effectiveDate && (
                      <p className="text-xs text-gray-500">
                        Effective: {new Date(regulation.effectiveDate).toLocaleDateString('en-US')}
                        {regulation.updatedDate && ` | Updated: ${new Date(regulation.updatedDate).toLocaleDateString('en-US')}`}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}

