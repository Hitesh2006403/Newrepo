import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useDonations } from '../../context/DonationContext';
import { Home, Clock, AlertTriangle, Send, Sparkles, Flame, ShieldAlert } from 'lucide-react';

export const PostRequirementModal = ({ isOpen, onClose, requirementToEdit = null }) => {
  const { currentUser } = useAuth();
  const { postRequirement, updateRequirement } = useDonations();

  const isEditing = Boolean(requirementToEdit);
  const isOpenStatus = !requirementToEdit || requirementToEdit.status === 'OPEN';

  const [formData, setFormData] = useState({
    title: '',
    foodType: 'cooked_meals',
    quantityNeeded: 40,
    unit: 'servings',
    dietaryPreference: 'vegetarian',
    priority: 'MEDIUM',
    neededInHours: 2,
    location: currentUser?.address || '14 Sunshine Cross, Near St. Anne School',
    contactPerson: currentUser?.name || 'Sister Teresa',
    specialNotes: 'Feeding 40 children for evening dinner.',
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (requirementToEdit) {
      setFormData({
        title: requirementToEdit.title || '',
        foodType: requirementToEdit.foodType || 'cooked_meals',
        quantityNeeded: requirementToEdit.quantityNeeded || 40,
        unit: requirementToEdit.unit || 'servings',
        dietaryPreference: requirementToEdit.dietaryPreference || 'vegetarian',
        priority: requirementToEdit.priority || requirementToEdit.urgency || 'MEDIUM',
        neededInHours: 2,
        location: requirementToEdit.address?.formattedAddress || requirementToEdit.location || '',
        contactPerson: currentUser?.name || 'Authorized Beneficiary',
        specialNotes: '',
      });
    } else {
      setFormData({
        title: '',
        foodType: 'cooked_meals',
        quantityNeeded: 40,
        unit: 'servings',
        dietaryPreference: 'vegetarian',
        priority: 'MEDIUM',
        neededInHours: 2,
        location: currentUser?.address || '14 Sunshine Cross, Near St. Anne School',
        contactPerson: currentUser?.name || 'Sister Teresa',
        specialNotes: 'Feeding 40 children for evening dinner.',
      });
    }
    setErrorMessage('');
  }, [requirementToEdit, currentUser, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isEditing && !isOpenStatus) {
      setErrorMessage('Editing is only permitted while the requirement status is OPEN.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage('');

      const neededBefore = new Date(Date.now() + formData.neededInHours * 60 * 60 * 1000).toISOString();

      if (isEditing) {
        await updateRequirement(requirementToEdit.id || requirementToEdit._id, {
          title: formData.title || `Requirement for ${formData.foodType}`,
          quantityNeeded: Number(formData.quantityNeeded),
          dietaryPreference: formData.dietaryPreference,
          neededBy: neededBefore,
          priority: formData.priority,
        });
      } else {
        await postRequirement({
          recipientId: currentUser?.id || 'recipient-1',
          recipientName: currentUser?.organizationName || currentUser?.name || 'Grace Hope Shelter',
          title: formData.title || `Requirement for ${formData.foodType}`,
          foodType: formData.foodType,
          quantityNeeded: Number(formData.quantityNeeded),
          unit: formData.unit,
          dietaryPreference: formData.dietaryPreference,
          priority: formData.priority,
          neededBefore,
          location: formData.location,
          contactPerson: formData.contactPerson,
          specialNotes: formData.specialNotes,
        });
      }

      onClose();
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || 'Operation failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Food Requirement' : 'Submit Food Need / Requirement'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            {errorMessage}
          </div>
        )}

        {isEditing && !isOpenStatus && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
            ⚠️ This requirement is currently <strong>{requirementToEdit.status}</strong>. Requirements can only be edited while <strong>OPEN</strong>.
          </div>
        )}

        {/* Priority Selector */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
            Requirement Priority Level *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                value: 'LOW',
                label: 'Low',
                desc: 'Standard non-urgent replenishment (next 24+ hrs)',
                color: 'border-emerald-300 text-emerald-800 bg-emerald-50/50',
                activeColor: 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500',
              },
              {
                value: 'MEDIUM',
                label: 'Medium (Default)',
                desc: 'Regular daily meal schedule (next 6-8 hrs)',
                color: 'border-amber-300 text-amber-800 bg-amber-50/50',
                activeColor: 'border-amber-500 bg-amber-50 ring-2 ring-amber-500',
              },
              {
                value: 'HIGH',
                label: 'High',
                desc: 'Urgent immediate need; prioritizes smart match pairing',
                color: 'border-rose-300 text-rose-800 bg-rose-50/50',
                activeColor: 'border-rose-500 bg-rose-50 ring-2 ring-rose-500',
              },
            ].map((p) => (
              <label
                key={p.value}
                className={`relative flex flex-col p-3 rounded-xl border cursor-pointer transition ${
                  formData.priority === p.value ? p.activeColor : p.color
                } ${isEditing && !isOpenStatus ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">{p.label}</span>
                  <input
                    type="radio"
                    name="priority"
                    value={p.value}
                    disabled={isEditing && !isOpenStatus}
                    checked={formData.priority === p.value}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="accent-rose-600"
                  />
                </div>
                <span className="text-[11px] text-slate-500 mt-1 leading-snug">{p.desc}</span>
              </label>
            ))}
          </div>
          <p className="text-[11px] text-slate-400">
            * Note: Sent as user-chosen priority. Coexists alongside the automatic countdown timer.
          </p>
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Requirement Title
          </label>
          <input
            type="text"
            disabled={isEditing && !isOpenStatus}
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g. Evening dinner meals for 40 children"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium disabled:bg-slate-100"
          />
        </div>

        {/* Food Type & Dietary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Food Type Needed
            </label>
            <select
              disabled={isEditing}
              value={formData.foodType}
              onChange={(e) => setFormData({ ...formData, foodType: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white disabled:bg-slate-100"
            >
              <option value="cooked_meals">Cooked Meals (Ready to Eat)</option>
              <option value="bakery_items">Bakery / Breads</option>
              <option value="packaged_food">Packaged Grocery / Dry Staples</option>
              <option value="raw_groceries">Fresh Fruits & Vegetables</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Dietary Preference
            </label>
            <select
              disabled={isEditing && !isOpenStatus}
              value={formData.dietaryPreference}
              onChange={(e) => setFormData({ ...formData, dietaryPreference: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white disabled:bg-slate-100"
            >
              <option value="vegetarian">Vegetarian Only</option>
              <option value="non_vegetarian">Non-Vegetarian Accepted</option>
              <option value="vegan">Vegan Only</option>
              <option value="any">Any / No Dietary Restriction</option>
            </select>
          </div>
        </div>

        {/* Quantity & Units */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Quantity Needed *
            </label>
            <input
              type="number"
              min="1"
              required
              disabled={isEditing && !isOpenStatus}
              value={formData.quantityNeeded}
              onChange={(e) => setFormData({ ...formData, quantityNeeded: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Unit
            </label>
            <select
              disabled={isEditing}
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white disabled:bg-slate-100"
            >
              <option value="servings">Servings / Meals</option>
              <option value="plates">Plates</option>
              <option value="kg">Kilograms (kg)</option>
              <option value="packets">Packets</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Needed Within (Hrs)
            </label>
            <select
              disabled={isEditing && !isOpenStatus}
              value={formData.neededInHours}
              onChange={(e) => setFormData({ ...formData, neededInHours: Number(e.target.value) })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white disabled:bg-slate-100"
            >
              <option value="1.5">1.5 Hours</option>
              <option value="3">3 Hours</option>
              <option value="6">6 Hours</option>
              <option value="12">12 Hours</option>
              <option value="24">24 Hours</option>
            </select>
          </div>
        </div>

        {/* Location (creation only) */}
        {!isEditing && (
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Delivery Address / Drop Location
            </label>
            <input
              type="text"
              required
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
        )}

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-100 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || (isEditing && !isOpenStatus)}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-md shadow-emerald-700/20 transition flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{submitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Broadcast Need to Donors'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
