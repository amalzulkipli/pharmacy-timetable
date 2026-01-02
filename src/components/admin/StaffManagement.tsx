'use client';

import { useState, useEffect } from 'react';
import { Users, Plus, Pencil, Trash2, Save, X, Loader2 } from 'lucide-react';

interface Staff {
  id: string;
  name: string;
  role: string;
  weeklyHours: number;
  defaultOffDays: number[];
  alEntitlement: number;
  isActive: boolean;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function StaffManagement() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    staffId: '',
    name: '',
    role: 'Pharmacist',
    weeklyHours: 45,
    defaultOffDays: [0, 6] as number[],
    alEntitlement: 14,
  });

  // Fetch staff list
  const fetchStaff = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/staff');
      if (!response.ok) throw new Error('Failed to fetch staff');
      const data = await response.json();
      setStaff(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load staff');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleEdit = (s: Staff) => {
    setEditingId(s.id);
    setFormData({
      staffId: s.id,
      name: s.name,
      role: s.role,
      weeklyHours: s.weeklyHours,
      defaultOffDays: s.defaultOffDays,
      alEntitlement: s.alEntitlement,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setShowAddForm(false);
    setFormData({
      staffId: '',
      name: '',
      role: 'Pharmacist',
      weeklyHours: 45,
      defaultOffDays: [0, 6],
      alEntitlement: 14,
    });
  };

  const toggleOffDay = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      defaultOffDays: prev.defaultOffDays.includes(day)
        ? prev.defaultOffDays.filter((d) => d !== day)
        : [...prev.defaultOffDays, day].sort(),
    }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const isEditing = editingId !== null;
      const url = isEditing ? `/api/staff/${editingId}` : '/api/staff';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save');
      }

      await fetchStaff();
      handleCancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (staffId: string) => {
    if (!confirm('Are you sure you want to deactivate this staff member?')) return;

    try {
      const response = await fetch(`/api/staff/${staffId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');
      await fetchStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600">Loading staff...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900">Staff Management</h3>
        </div>
        {!showAddForm && !editingId && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Staff
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Add/Edit Form */}
      {(showAddForm || editingId) && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
          <h4 className="text-sm font-medium text-gray-700 mb-4">
            {editingId ? 'Edit Staff Member' : 'Add New Staff Member'}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Staff ID</label>
              <input
                type="text"
                value={formData.staffId}
                onChange={(e) => setFormData((p) => ({ ...p, staffId: e.target.value.toLowerCase() }))}
                disabled={!!editingId}
                className="w-full px-3 py-2 border rounded-md text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-500"
                placeholder="e.g., john"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md text-sm text-gray-900"
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData((p) => ({ ...p, role: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md text-sm text-gray-900"
              >
                <option value="Pharmacist">Pharmacist</option>
                <option value="Assistant Pharmacist">Assistant Pharmacist</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Weekly Hours</label>
              <input
                type="number"
                value={formData.weeklyHours}
                onChange={(e) => setFormData((p) => ({ ...p, weeklyHours: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border rounded-md text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">AL Entitlement (days/year)</label>
              <input
                type="number"
                value={formData.alEntitlement}
                onChange={(e) => setFormData((p) => ({ ...p, alEntitlement: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border rounded-md text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Default Off Days</label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day, idx) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleOffDay(idx)}
                    className={`px-3 py-1 text-xs font-medium rounded-full ${
                      formData.defaultOffDays.includes(idx)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <button
              onClick={handleCancelEdit}
              className="flex items-center px-3 py-2 border rounded-md text-sm text-gray-600 hover:bg-gray-100"
            >
              <X className="w-4 h-4 mr-1" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Save
            </button>
          </div>
        </div>
      )}

      {/* Staff List */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours/Week</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Off Days</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">AL Days</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {staff.filter((s) => s.isActive).map((s) => {
              return (
                <tr key={s.id}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.role}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.weeklyHours}h</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {s.defaultOffDays.map((d) => DAYS[d]).join(', ')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.alEntitlement} days</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(s)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Deactivate"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
