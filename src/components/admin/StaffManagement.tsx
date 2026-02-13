'use client';

import { useState, useEffect } from 'react';
import { Users, Plus, Pencil, Trash2, Save, X, Loader2 } from 'lucide-react';
import { AVATAR_COLORS } from '@/staff-data';
import { apiUrl } from '@/lib/api';

interface Staff {
  id: string;
  name: string;
  role: string;
  weeklyHours: number;
  alEntitlement: number;
  mlEntitlement: number;
  startDate?: string | null;
  colorIndex?: number | null;
  isActive: boolean;
}

interface StaffManagementProps {
  isMobile?: boolean;
}

// Mobile Staff Card Component
function MobileStaffListCard({
  staff,
  onEdit,
  onDelete,
}: {
  staff: Staff;
  onEdit: (s: Staff) => void;
  onDelete: (id: string) => void;
}) {
  const avatarColors = AVATAR_COLORS[staff.id] || { bg: 'bg-gray-500' };
  const initials = staff.name.substring(0, 2).toUpperCase();

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      {/* Header: Avatar + Name + Role */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`w-12 h-12 ${avatarColors.bg} rounded-full flex items-center justify-center flex-shrink-0`}
        >
          <span className="text-white font-bold text-sm">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 truncate">{staff.name}</h4>
          <p className="text-sm text-gray-500">{staff.role}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-lg font-semibold text-gray-900">{staff.weeklyHours}h</div>
          <div className="text-xs text-gray-500">Weekly</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <div className="text-lg font-semibold text-blue-700">{staff.alEntitlement}</div>
          <div className="text-xs text-blue-600">AL Days</div>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <div className="text-lg font-semibold text-green-700">{staff.mlEntitlement}</div>
          <div className="text-xs text-green-600">ML Days</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onEdit(staff)}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 text-blue-600 rounded-lg font-medium text-sm min-h-[48px]"
        >
          <Pencil className="w-5 h-5" />
          Edit
        </button>
        <button
          onClick={() => onDelete(staff.id)}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-lg font-medium text-sm min-h-[48px]"
        >
          <Trash2 className="w-5 h-5" />
          Remove
        </button>
      </div>
    </div>
  );
}

export default function StaffManagement({ isMobile = false }: StaffManagementProps) {
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
    alEntitlement: 14,
    mlEntitlement: 14,
    startDate: '',  // Empty string = no start date restriction
  });

  // Fetch staff list
  const fetchStaff = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(apiUrl('/api/staff'));
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
      alEntitlement: s.alEntitlement,
      mlEntitlement: s.mlEntitlement,
      startDate: s.startDate ? s.startDate.split('T')[0] : '',  // Format as YYYY-MM-DD
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
      alEntitlement: 14,
      mlEntitlement: 14,
      startDate: '',
    });
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const isEditing = editingId !== null;
      const url = isEditing ? apiUrl(`/api/staff/${editingId}`) : apiUrl('/api/staff');
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
      const response = await fetch(apiUrl(`/api/staff/${staffId}`), {
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
    <div className={`bg-white rounded-lg shadow-sm border ${isMobile ? 'p-4' : 'p-6'}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900">Staff Management</h3>
        </div>
        {!showAddForm && !editingId && (
          <button
            onClick={() => setShowAddForm(true)}
            className={`flex items-center justify-center bg-brand text-white font-medium rounded-lg hover:bg-brand-dark ${
              isMobile ? 'px-4 py-3 text-sm min-h-[48px]' : 'px-3 py-2 text-sm'
            }`}
          >
            <Plus className={isMobile ? 'w-5 h-5 mr-2' : 'w-4 h-4 mr-1'} />
            {isMobile ? 'Add' : 'Add Staff'}
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
          <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Staff ID</label>
              <input
                type="text"
                value={formData.staffId}
                onChange={(e) => setFormData((p) => ({ ...p, staffId: e.target.value.toLowerCase() }))}
                disabled={!!editingId}
                className={`w-full border rounded-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 ${
                  isMobile ? 'px-4 py-3 text-base min-h-[48px]' : 'px-3 py-2 text-sm'
                }`}
                placeholder="e.g., john"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                className={`w-full border rounded-lg text-gray-900 ${
                  isMobile ? 'px-4 py-3 text-base min-h-[48px]' : 'px-3 py-2 text-sm'
                }`}
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData((p) => ({ ...p, role: e.target.value }))}
                className={`w-full border rounded-lg text-gray-900 ${
                  isMobile ? 'px-4 py-3 text-base min-h-[48px]' : 'px-3 py-2 text-sm'
                }`}
              >
                <option value="Pharmacist">Pharmacist</option>
                <option value="Assistant Pharmacist">Assistant Pharmacist</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Weekly Hours</label>
              <input
                type="number"
                value={formData.weeklyHours}
                onChange={(e) => setFormData((p) => ({ ...p, weeklyHours: parseInt(e.target.value) || 0 }))}
                className={`w-full border rounded-lg text-gray-900 ${
                  isMobile ? 'px-4 py-3 text-base min-h-[48px]' : 'px-3 py-2 text-sm'
                }`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">AL Entitlement (days/year)</label>
              <input
                type="number"
                value={formData.alEntitlement}
                onChange={(e) => setFormData((p) => ({ ...p, alEntitlement: parseInt(e.target.value) || 0 }))}
                className={`w-full border rounded-lg text-gray-900 ${
                  isMobile ? 'px-4 py-3 text-base min-h-[48px]' : 'px-3 py-2 text-sm'
                }`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">ML Entitlement (days/year)</label>
              <input
                type="number"
                value={formData.mlEntitlement}
                onChange={(e) => setFormData((p) => ({ ...p, mlEntitlement: parseInt(e.target.value) || 0 }))}
                className={`w-full border rounded-lg text-gray-900 ${
                  isMobile ? 'px-4 py-3 text-base min-h-[48px]' : 'px-3 py-2 text-sm'
                }`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Start Date (optional)</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData((p) => ({ ...p, startDate: e.target.value }))}
                className={`w-full border rounded-lg text-gray-900 ${
                  isMobile ? 'px-4 py-3 text-base min-h-[48px]' : 'px-3 py-2 text-sm'
                }`}
                placeholder="Leave empty for no date restriction"
              />
              <p className="mt-1 text-xs text-gray-500">Staff will appear in timetable from this date forward</p>
            </div>
          </div>
          <div className={`mt-4 ${isMobile ? 'flex flex-col gap-2' : 'flex justify-end space-x-2'}`}>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`flex items-center justify-center bg-brand text-white font-medium rounded-lg hover:bg-brand-dark disabled:opacity-50 ${
                isMobile ? 'px-4 py-3 text-base min-h-[48px] order-1' : 'px-3 py-2 text-sm'
              }`}
            >
              {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
              Save
            </button>
            <button
              onClick={handleCancelEdit}
              className={`flex items-center justify-center border rounded-lg text-gray-600 hover:bg-gray-100 ${
                isMobile ? 'px-4 py-3 text-base min-h-[48px] order-2' : 'px-3 py-2 text-sm'
              }`}
            >
              <X className="w-5 h-5 mr-2" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Staff List */}
      {isMobile ? (
        /* Mobile Card Layout */
        <div className="space-y-4">
          {staff.filter((s) => s.isActive).map((s) => (
            <MobileStaffListCard
              key={s.id}
              staff={s}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        /* Desktop Table Layout */
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours/Week</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">AL Days</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ML Days</th>
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
                    <td className="px-4 py-3 text-sm text-gray-600">{s.alEntitlement} days</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.mlEntitlement} days</td>
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
      )}
    </div>
  );
}
