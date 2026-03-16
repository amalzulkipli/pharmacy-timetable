'use client';

import { useState, useEffect } from 'react';
import { Users, Plus, Pencil, Trash2, Save, X, Loader2, CalendarOff } from 'lucide-react';
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
  endDate?: string | null;
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
  onEndService,
  onClearEndDate,
}: {
  staff: Staff;
  onEdit: (s: Staff) => void;
  onDelete: (id: string) => void;
  onEndService: (s: Staff) => void;
  onClearEndDate: (id: string) => void;
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

      {/* End Date Badge */}
      {staff.endDate && (
        <div className="flex items-center justify-between mb-4 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
          <span className="text-sm text-orange-700">
            Ends: {new Date(staff.endDate).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <button
            onClick={() => onClearEndDate(staff.id)}
            className="text-xs text-orange-600 hover:text-orange-800 font-medium"
          >
            Clear
          </button>
        </div>
      )}

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
          onClick={() => onEndService(staff)}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-orange-50 text-orange-600 rounded-lg font-medium text-sm min-h-[48px]"
        >
          <CalendarOff className="w-5 h-5" />
          {staff.endDate ? 'Edit End' : 'End Service'}
        </button>
        <button
          onClick={() => onDelete(staff.id)}
          className="flex items-center justify-center gap-2 px-3 py-3 bg-red-50 text-red-600 rounded-lg font-medium text-sm min-h-[48px]"
          title="Set Inactive"
        >
          <Trash2 className="w-5 h-5" />
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

  // End Service dialog state
  const [endServiceStaffId, setEndServiceStaffId] = useState<string | null>(null);
  const [endServiceDate, setEndServiceDate] = useState('');
  const [isEndingService, setIsEndingService] = useState(false);

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
    if (!confirm('Are you sure you want to set this staff member as inactive?')) return;

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

  const handleEndService = async () => {
    if (!endServiceStaffId || !endServiceDate) return;

    try {
      setIsEndingService(true);
      const response = await fetch(apiUrl(`/api/staff/${endServiceStaffId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endDate: endServiceDate }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to set end date');
      }

      await fetchStaff();
      setEndServiceStaffId(null);
      setEndServiceDate('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set end date');
    } finally {
      setIsEndingService(false);
    }
  };

  const handleClearEndDate = async (staffId: string) => {
    try {
      const response = await fetch(apiUrl(`/api/staff/${staffId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endDate: null }),
      });

      if (!response.ok) throw new Error('Failed to clear end date');
      await fetchStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear end date');
    }
  };

  const openEndServiceDialog = (s: Staff) => {
    setEndServiceStaffId(s.id);
    setEndServiceDate(s.endDate ? s.endDate.split('T')[0] : '');
  };

  const formatLastDay = (endDateStr: string) => {
    const d = new Date(endDateStr);
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
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

      {/* End Service Dialog */}
      {endServiceStaffId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <CalendarOff className="w-5 h-5 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">End Service</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Set the date when this staff member will stop appearing in the timetable.
              They will still appear on dates before this.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={endServiceDate}
                onChange={(e) => setEndServiceDate(e.target.value)}
                className="w-full border rounded-lg px-4 py-3 text-gray-900"
              />
              {endServiceDate && (
                <p className="mt-2 text-sm text-gray-500">
                  Last day on timetable: <span className="font-medium text-gray-700">{formatLastDay(endServiceDate)}</span>
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleEndService}
                disabled={!endServiceDate || isEndingService}
                className="flex-1 px-4 py-3 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50"
              >
                {isEndingService ? 'Saving...' : 'Confirm'}
              </button>
              <button
                onClick={() => { setEndServiceStaffId(null); setEndServiceDate(''); }}
                className="flex-1 px-4 py-3 border rounded-lg text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
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
              onEndService={openEndServiceDialog}
              onClearEndDate={handleClearEndDate}
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">End Date</th>
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
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {s.endDate ? (
                        <div className="flex items-center gap-2">
                          <span className="text-orange-600 font-medium">
                            {new Date(s.endDate).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <button
                            onClick={() => handleClearEndDate(s.id)}
                            className="text-xs text-gray-400 hover:text-red-500"
                            title="Clear end date"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400">&mdash;</span>
                      )}
                    </td>
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
                          onClick={() => openEndServiceDialog(s)}
                          className="p-1 text-orange-600 hover:bg-orange-50 rounded"
                          title={s.endDate ? 'Edit End Date' : 'End Service'}
                        >
                          <CalendarOff className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Set Inactive"
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
