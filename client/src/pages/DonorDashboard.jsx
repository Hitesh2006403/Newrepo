import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDonations } from '../context/DonationContext';
import { DonationCard } from '../components/donor/DonationCard';
import { CreateDonationModal } from '../components/donor/CreateDonationModal';
import { ReopenModal } from '../components/donor/ReopenModal';
import { QrCodeModal } from '../components/common/QrCodeModal';
import {
  UtensilsCrossed,
  PlusCircle,
  Filter,
  Sparkles,
  HeartHandshake,
  CheckCircle2,
  Clock,
} from 'lucide-react';

export const DonorDashboard = ({ isCreateOpen, setIsCreateOpen }) => {
  const { currentUser } = useAuth();
  const { donations, loading } = useDonations();
  const [activeTab, setActiveTab] = useState('ALL');
  const [selectedDonationForQr, setSelectedDonationForQr] = useState(null);
  const [selectedDonationForReopen, setSelectedDonationForReopen] = useState(null);

  // Filter donations relevant to this donor or show all for hackathon demonstration
  const donorDonations = donations;

  const filtered = donorDonations.filter((d) => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'ACTIVE') return d.status === 'AVAILABLE' || d.status === 'REOPENED';
    if (activeTab === 'PARTIALLY_ACCEPTED') return d.status === 'PARTIALLY_ACCEPTED';
    if (activeTab === 'PICKUP_SCHEDULED') return d.status === 'PICKUP_SCHEDULED' || d.status === 'OUT_FOR_DELIVERY';
    if (activeTab === 'COMPLETED') return d.status === 'COMPLETED';
    if (activeTab === 'CANCELLED') return d.status === 'CANCELLED';
    return true;
  });

  const activeCount = donorDonations.filter(
    (d) => d.status === 'AVAILABLE' || d.status === 'PARTIALLY_ACCEPTED' || d.status === 'REOPENED'
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Hero Banner */}
      <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-amber-900 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-1.5 bg-white/15 px-3 py-1 rounded-full text-xs font-semibold text-amber-200">
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>Donor Hub • {currentUser?.organizationName || 'Kitchen Operations'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Rescue Surplus Food Before It Expires
          </h2>
          <p className="text-sm text-rose-100/90 leading-relaxed">
            Every minute counts. Post excess buffet meals, bakery goods, and groceries with live expiry countdowns. Our smart-match engine immediately routes food to local shelters.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsCreateOpen(true)}
              className="bg-white hover:bg-amber-50 active:scale-95 text-rose-800 font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-md transition flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4 text-rose-600" />
              <span>Post Food Surplus Now</span>
            </button>
            <span className="text-xs text-rose-200 font-medium">
              ⚡ {activeCount} active batch(es) currently rescue-ready
            </span>
          </div>
        </div>

        {/* Ambient Decorative Shapes */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-amber-500/20 to-transparent pointer-events-none" />
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          {[
            { id: 'ALL', label: 'All Batches' },
            { id: 'ACTIVE', label: 'Ready for Pickup' },
            { id: 'PARTIALLY_ACCEPTED', label: 'Partially Claimed' },
            { id: 'PICKUP_SCHEDULED', label: 'Pickup / Transit' },
            { id: 'COMPLETED', label: 'Completed' },
            { id: 'CANCELLED', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-500 font-medium">
          Showing {filtered.length} donation batch(es)
        </span>
      </div>

      {/* Donation Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center space-y-3">
          <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-slate-800">No donations in this category</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Post surplus food items to connect directly with orphanages and community kitchens.
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 bg-rose-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-rose-500 transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create First Surplus Post</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((donation) => (
            <DonationCard
              key={donation.id}
              donation={donation}
              onShowQr={(don) => setSelectedDonationForQr(don)}
              onReopen={(don) => setSelectedDonationForReopen(don)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateDonationModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      <QrCodeModal
        isOpen={!!selectedDonationForQr}
        onClose={() => setSelectedDonationForQr(null)}
        donation={selectedDonationForQr}
      />

      <ReopenModal
        isOpen={!!selectedDonationForReopen}
        onClose={() => setSelectedDonationForReopen(null)}
        donation={selectedDonationForReopen}
      />
    </div>
  );
};
