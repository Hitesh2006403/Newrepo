import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useDonations } from '../../context/DonationContext';
import { Utensils, Clock, ShieldCheck, MapPin, Sparkles, Flame, ShieldAlert } from 'lucide-react';

const SAMPLE_IMAGES = [
  { label: 'Hot Meals', url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80' },
  { label: 'Bakery', url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80' },
  { label: 'Fresh Produce', url: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=600&q=80' },
  { label: 'Rice & Curry', url: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=600&q=80' },
];

export const CreateDonationModal = ({ isOpen, onClose, donationToEdit = null }) => {
  const { currentUser } = useAuth();
  const { createDonation, updateDonation } = useDonations();

  const isEditing = Boolean(donationToEdit);
  const isAvailable = !donationToEdit || donationToEdit.status === 'AVAILABLE';

  const [formData, setFormData] = useState({
    foodName: '',
    venueType: 'HOTELS',
    foodType: 'cooked_meals',
    initialQuantity: 50,
    unit: 'servings',
    dietaryCategory: 'veg',
    storageCondition: 'heated',
    hoursUntilExpiry: 3,
    safetyBufferMinutes: 45,
    priority: 'MEDIUM',
    pickupAddress: currentUser?.address || 'MG Road, Bengaluru',
    pickupLandmark: 'Loading Bay Gate 2',
    pickupAvailability: 'Immediate pickup preferred',
    imageUrl: SAMPLE_IMAGES[0].url,
    declarations: {
      hygieneChecked: true,
      temperatureSafe: true,
      sealedPacks: true,
    },
    allergenNotes: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (donationToEdit) {
      setFormData({
        foodName: donationToEdit.foodName || '',
        venueType: donationToEdit.venueType || 'HOTELS',
        foodType: donationToEdit.foodType || 'cooked_meals',
        initialQuantity: donationToEdit.totalQuantity || donationToEdit.initialQuantity || 50,
        unit: donationToEdit.unit || 'servings',
        dietaryCategory: donationToEdit.dietaryCategory || 'veg',
        storageCondition: donationToEdit.storageCondition || donationToEdit.instructions || 'heated',
        hoursUntilExpiry: 3,
        safetyBufferMinutes: donationToEdit.safetyBufferMinutes || 45,
        priority: donationToEdit.priority || 'MEDIUM',
        pickupAddress: donationToEdit.pickupLocation?.address || '',
        pickupLandmark: donationToEdit.pickupLocation?.landmark || '',
        pickupAvailability: donationToEdit.pickupAvailability || '',
        imageUrl: donationToEdit.imageUrl || SAMPLE_IMAGES[0].url,
        declarations: {
          hygieneChecked: true,
          temperatureSafe: true,
          sealedPacks: true,
        },
        allergenNotes: '',
      });
    } else {
      setFormData({
        foodName: '',
        venueType: 'HOTELS',
        foodType: 'cooked_meals',
        initialQuantity: 50,
        unit: 'servings',
        dietaryCategory: 'veg',
        storageCondition: 'heated',
        hoursUntilExpiry: 3,
        safetyBufferMinutes: 45,
        priority: 'MEDIUM',
        pickupAddress: currentUser?.address || 'MG Road, Bengaluru',
        pickupLandmark: 'Loading Bay Gate 2',
        pickupAvailability: 'Immediate pickup preferred',
        imageUrl: SAMPLE_IMAGES[0].url,
        declarations: {
          hygieneChecked: true,
          temperatureSafe: true,
          sealedPacks: true,
        },
        allergenNotes: '',
      });
    }
    setErrorMessage('');
  }, [donationToEdit, currentUser, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.foodName.trim()) return;

    if (isEditing && !isAvailable) {
      setErrorMessage('Editing is only allowed while the donation is in AVAILABLE status with no claims.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage('');

      if (isEditing) {
        await updateDonation(donationToEdit.id || donationToEdit._id, {
          foodName: formData.foodName,
          priority: formData.priority,
          instructions: formData.storageCondition,
        });
      } else {
        const now = new Date();
        const cookedTime = new Date(now.getTime() - 45 * 60 * 1000).toISOString();
        const expiryDeadline = new Date(now.getTime() + formData.hoursUntilExpiry * 60 * 60 * 1000).toISOString();

        await createDonation({
          donorId: currentUser?.id || 'donor-1',
          donorName: currentUser?.organizationName || currentUser?.name || 'Grand Hyatt Bistro',
          venueType: formData.venueType,
          donorPhone: currentUser?.phone || '+91 98765 43210',
          foodName: formData.foodName,
          foodType: formData.foodType,
          initialQuantity: Number(formData.initialQuantity),
          remainingQuantity: Number(formData.initialQuantity),
          unit: formData.unit,
          dietaryCategory: formData.dietaryCategory,
          storageCondition: formData.storageCondition,
          cookedTime,
          expiryDeadline,
          safetyBufferMinutes: Number(formData.safetyBufferMinutes),
          priority: formData.priority,
          imageUrl: formData.imageUrl,
          pickupLocation: {
            address: formData.pickupAddress,
            landmark: formData.pickupLandmark,
            coordinates: [77.62, 12.97],
          },
          pickupAvailability: formData.pickupAvailability,
          foodSafetyDeclaration: {
            hygienicallyPrepared: formData.declarations.hygieneChecked,
            temperatureMaintained: formData.declarations.temperatureSafe,
            sealedPackaging: formData.declarations.sealedPacks,
            allergenNotes: formData.allergenNotes || 'No undeclared allergens.',
          },
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
      title={isEditing ? 'Edit Surplus Food Donation' : 'Post Surplus Food Donation'}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            {errorMessage}
          </div>
        )}

        {isEditing && !isAvailable && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
            ⚠️ This donation is currently <strong>{donationToEdit.status}</strong>. Donations can only be edited while <strong>AVAILABLE</strong>.
          </div>
        )}

        {/* Priority Level Selector */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
            User-Chosen Priority Level *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                value: 'LOW',
                label: 'Low',
                desc: 'Standard distribution window for non-perishables or dry goods',
                color: 'border-emerald-300 text-emerald-800 bg-emerald-50/50',
                activeColor: 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500',
              },
              {
                value: 'MEDIUM',
                label: 'Medium (Default)',
                desc: 'Standard priority for standard community kitchen matching',
                color: 'border-amber-300 text-amber-800 bg-amber-50/50',
                activeColor: 'border-amber-500 bg-amber-50 ring-2 ring-amber-500',
              },
              {
                value: 'HIGH',
                label: 'High',
                desc: 'Immediate urgent rescue; dispatches instant alerts to shelters',
                color: 'border-rose-300 text-rose-800 bg-rose-50/50',
                activeColor: 'border-rose-500 bg-rose-50 ring-2 ring-rose-500',
              },
            ].map((p) => (
              <label
                key={p.value}
                className={`relative flex flex-col p-3 rounded-xl border cursor-pointer transition ${
                  formData.priority === p.value ? p.activeColor : p.color
                } ${isEditing && !isAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">{p.label}</span>
                  <input
                    type="radio"
                    name="priority"
                    value={p.value}
                    disabled={isEditing && !isAvailable}
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
            * Note: Priority is user-chosen and coexists alongside the automatic countdown timer. Both stay and both are shown.
          </p>
        </div>

        {/* Food Name & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Food Item / Preparation Name *
            </label>
            <input
              type="text"
              required
              disabled={isEditing && !isAvailable}
              value={formData.foodName}
              onChange={(e) => setFormData({ ...formData, foodName: e.target.value })}
              placeholder="e.g. Executive Buffet: Dal Makhani, Rice & Naan"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm font-medium disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Food Category
            </label>
            <select
              disabled={isEditing}
              value={formData.foodType}
              onChange={(e) => setFormData({ ...formData, foodType: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm bg-white disabled:bg-slate-100"
            >
              <option value="cooked_meals">Cooked Meals (Hot)</option>
              <option value="bakery">Bakery & Breads</option>
              <option value="packaged_food">Packaged Grocery</option>
              <option value="fresh_produce">Fresh Fruits / Veg</option>
              <option value="dairy">Dairy Products</option>
            </select>
          </div>
        </div>

        {/* Venue Type */}
        {!isEditing && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Donor Venue Type
              </label>
              <select
                value={formData.venueType}
                onChange={(e) => setFormData({ ...formData, venueType: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm bg-white"
              >
                <option value="HOTELS">HOTELS (Hotels, Resorts & Luxury Banquets)</option>
                <option value="Resturant">Resturant (Restaurants, Cafes & Bistros)</option>
                <option value="Event venue">Event venue (Weddings, Conventions & Catering)</option>
                <option value="Others">Others (Hostels, Food Courts & Community)</option>
              </select>
            </div>
          </div>
        )}

        {/* Quantity, Units & Dietary */}
        {!isEditing && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Quantity Available *
              </label>
              <input
                type="number"
                min="1"
                required
                value={formData.initialQuantity}
                onChange={(e) => setFormData({ ...formData, initialQuantity: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Unit
              </label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm bg-white"
              >
                <option value="servings">Servings / Meals</option>
                <option value="kg">Kilograms (kg)</option>
                <option value="packets">Packets / Trays</option>
                <option value="boxes">Boxes / Crates</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Dietary Type
              </label>
              <select
                value={formData.dietaryCategory}
                onChange={(e) => setFormData({ ...formData, dietaryCategory: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm bg-white"
              >
                <option value="veg">Vegetarian</option>
                <option value="non_veg">Non-Vegetarian</option>
                <option value="vegan">100% Vegan</option>
              </select>
            </div>
          </div>
        )}

        {/* Storage condition / Instructions */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Storage & Handling Instructions
          </label>
          <input
            type="text"
            disabled={isEditing && !isAvailable}
            value={formData.storageCondition}
            onChange={(e) => setFormData({ ...formData, storageCondition: e.target.value })}
            placeholder="e.g. Keep refrigerated until courier collection"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm font-medium disabled:bg-slate-100"
          />
        </div>

        {/* Expiry Window & Safety Buffer (creation only) */}
        {!isEditing && (
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-wider">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Expiry Deadline & Safety Buffer (Automatic Urgency Countdown)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Safe Consumption Window (from now):
                </label>
                <select
                  value={formData.hoursUntilExpiry}
                  onChange={(e) => setFormData({ ...formData, hoursUntilExpiry: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-sm"
                >
                  <option value="1.5">1.5 hours (High Urgency / Immediate Pick)</option>
                  <option value="2.5">2.5 hours (Standard Hot Meal)</option>
                  <option value="4">4.0 hours (Chilled / Insulated)</option>
                  <option value="8">8.0 hours (Bakery / Produce)</option>
                  <option value="24">24 hours (Packaged Goods)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Safety Buffer Minutes (Pre-expiry cutoff):
                </label>
                <select
                  value={formData.safetyBufferMinutes}
                  onChange={(e) => setFormData({ ...formData, safetyBufferMinutes: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-sm"
                >
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes (Default)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Pickup Location (creation only) */}
        {!isEditing && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                Pickup Street Address
              </label>
              <input
                type="text"
                required
                value={formData.pickupAddress}
                onChange={(e) => setFormData({ ...formData, pickupAddress: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Landmark / Loading Bay
              </label>
              <input
                type="text"
                value={formData.pickupLandmark}
                onChange={(e) => setFormData({ ...formData, pickupLandmark: e.target.value })}
                placeholder="e.g. Service Gate 3, near security desk"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium"
              />
            </div>
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
            disabled={submitting || (isEditing && !isAvailable)}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-bold text-sm shadow-md shadow-rose-600/30 transition flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <Utensils className="w-4 h-4" />
            <span>{submitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Publish Surplus Donation'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
