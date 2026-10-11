import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDonations } from '../context/DonationContext';
import { api } from '../services/api';
import { MatchCard } from '../components/recipient/MatchCard';
import { PostRequirementModal } from '../components/recipient/PostRequirementModal';
import { AcceptModal } from '../components/recipient/AcceptModal';
import { QrCodeModal } from '../components/common/QrCodeModal';
import { RecipientQrScannerModal } from '../components/recipient/RecipientQrScannerModal';
import { ReviewsSection } from '../components/common/ReviewsSection';
import { PriorityBadge } from '../components/common/PriorityBadge';
import OfferBanner from '../features/matching/OfferBanner';
import { SpatialCard } from '../features/spatial';
import {
  Home,
  Sparkles,
  PlusCircle,
  Clock,
  MapPin,
  AlertCircle,
  CheckCircle2,
  QrCode,
  Scan,
  Search,
  X,
  Filter,
  ArrowUpDown,
  Edit3,
} from 'lucide-react';

export const RecipientDashboard = ({ isPostReqOpen, setIsPostReqOpen }) => {
  const { currentUser } = useAuth();
  const { donations, requirements } = useDonations();
  const [smartMatches, setSmartMatches] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dietaryFilter, setDietaryFilter] = useState('ALL');
  const [selectedPriorities, setSelectedPriorities] = useState([]);
  const [sortOption, setSortOption] = useState('matchScore_desc');
  const [selectedDonationForClaim, setSelectedDonationForClaim] = useState(null);
  const [selectedDonationForQr, setSelectedDonationForQr] = useState(null);
  const [selectedDonationForScanner, setSelectedDonationForScanner] = useState(null);
  const [editingRequirement, setEditingRequirement] = useState(null);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const matches = await api.getSmartMatches(currentUser?.id || 'recipient-1');
        setSmartMatches(matches);
      } catch (e) {
        console.error(e);
      }
    };
    fetchMatches();
  }, [donations, currentUser]);

  // Recipient requirement priority counters
  const reqPriorityCounts = {
    LOW: requirements.filter((r) => (r.priority || 'MEDIUM') === 'LOW').length,
    MEDIUM: requirements.filter((r) => (r.priority || 'MEDIUM') === 'MEDIUM').length,
    HIGH: requirements.filter((r) => (r.priority || 'MEDIUM') === 'HIGH').length,
  };

  const togglePriorityFilter = (val) => {
    setSelectedPriorities((prev) =>
      prev.includes(val) ? prev.filter((p) => p !== val) : [...prev, val]
    );
  };

  // Recipient's claimed active handovers
  const claimedDonations = donations.filter((d) =>
    d.matchedRecipients?.some(
      (m) => m.recipientId === currentUser?.id || m.recipientName?.includes('Grace Hope')
    )
  );

  // Filter smart matches with search query, dietary category, and priority
  const filteredMatches = smartMatches.filter((m) => {
    const don = m.donation;
    const q = searchQuery.toLowerCase().trim();

    const matchesSearch =
      !q ||
      don.foodName.toLowerCase().includes(q) ||
      don.donorName.toLowerCase().includes(q) ||
      (don.pickupLocation?.address && don.pickupLocation.address.toLowerCase().includes(q)) ||
      (don.foodType && don.foodType.toLowerCase().includes(q));

    const matchesDiet =
      dietaryFilter === 'ALL' || (don.dietaryCategory && don.dietaryCategory.toLowerCase() === dietaryFilter.toLowerCase());

    const donPriority = don.priority || 'MEDIUM';
    const matchesPriority =
      selectedPriorities.length === 0 || selectedPriorities.includes(donPriority);

    return matchesSearch && matchesDiet && matchesPriority;
  });

  // Sort matches
  const sortedMatches = [...filteredMatches].sort((a, b) => {
    if (sortOption === 'matchScore_desc') {
      return (b.matchScore || 0) - (a.matchScore || 0);
    }
    if (sortOption === 'priority_desc') {
      const weightA = a.donation.priorityWeight || (a.donation.priority === 'HIGH' ? 3 : a.donation.priority === 'LOW' ? 1 : 2);
      const weightB = b.donation.priorityWeight || (b.donation.priority === 'HIGH' ? 3 : b.donation.priority === 'LOW' ? 1 : 2);
      if (weightB !== weightA) return weightB - weightA;
      return (b.matchScore || 0) - (a.matchScore || 0);
    }
    if (sortOption === 'expiry_asc') {
      return new Date(a.donation.expiryDeadline || 0) - new Date(b.donation.expiryDeadline || 0);
    }
    if (sortOption === 'distance') {
      return parseFloat(a.distanceKm || 99) - parseFloat(b.distanceKm || 99);
    }
    return 0;
  });

  return (
    <div className="space-y-8">
      {/* Top Hero Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-800 to-emerald-950 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-1.5 bg-white/15 px-3 py-1 rounded-full text-xs font-semibold text-emerald-200">
            <Home className="w-3.5 h-3.5" />
            <span>Recipient Organization • {currentUser?.organizationName || 'Children Shelter'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Surplus Food Routing & Smart Matching
          </h2>
          <p className="text-sm text-emerald-100/90 leading-relaxed">
            Specify meals needed with your chosen priority. Our explainable match algorithm pairs you with verified restaurants and hotels before food quality degrades.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                setEditingRequirement(null);
                setIsPostReqOpen(true);
              }}
              className="bg-white hover:bg-emerald-50 active:scale-95 text-emerald-900 font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-md transition flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4 text-emerald-700" />
              <span>+ Post Food Requirement</span>
            </button>
            <div className="flex items-center gap-2 text-xs text-emerald-100 font-medium flex-wrap">
              <span className="bg-white/10 px-2.5 py-1 rounded-lg">
                ⚡ {sortedMatches.length} Matches Nearby
              </span>
              <span className="bg-rose-500/20 text-rose-200 px-2.5 py-1 rounded-lg border border-rose-400/30">
                🔴 {reqPriorityCounts.HIGH} High Demands
              </span>
              <span className="bg-amber-500/20 text-amber-200 px-2.5 py-1 rounded-lg border border-amber-400/30">
                🟡 {reqPriorityCounts.MEDIUM} Medium
              </span>
              <span className="bg-emerald-500/20 text-emerald-200 px-2.5 py-1 rounded-lg border border-emerald-400/30">
                🟢 {reqPriorityCounts.LOW} Low
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Claimed Deliveries in Progress */}
      {claimedDonations.length > 0 && (
        <div className="bg-white rounded-2xl border border-indigo-200 p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping" />
              <h4 className="font-bold text-sm text-slate-800">
                Your Active Claimed Donations (Awaiting Handover)
              </h4>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-indigo-700 font-semibold bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
                {claimedDonations.length} Active
              </span>
              <button
                onClick={() => setSelectedDonationForScanner(claimedDonations[0])}
                className="flex items-center gap-1.5 text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-3 py-1.5 rounded-xl shadow-xs transition"
              >
                <Scan className="w-3.5 h-3.5" />
                <span>Scan Delivery QR</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {claimedDonations.map((don) => {
              const isReadyForReceiptScan = don.status === 'PICKED_UP';
              const isDelivered = don.status === 'DELIVERED' || don.status === 'COMPLETED';

              return (
                <div
                  key={don.id}
                  className={`border rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isReadyForReceiptScan
                      ? 'bg-purple-50/60 border-purple-200'
                      : isDelivered
                      ? 'bg-teal-50/60 border-teal-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 truncate">{don.foodName}</span>
                      <PriorityBadge priority={don.priority || 'MEDIUM'} compact />
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase ${
                        isDelivered
                          ? 'bg-teal-100 text-teal-800'
                          : isReadyForReceiptScan
                          ? 'bg-purple-100 text-purple-800 animate-pulse'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {don.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      From {don.donorName}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {isReadyForReceiptScan ? (
                      <button
                        onClick={() => setSelectedDonationForScanner(don)}
                        className="flex items-center gap-1.5 text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-3.5 py-2 rounded-xl shadow-xs transition"
                      >
                        <Scan className="w-3.5 h-3.5" />
                        <span>Scan Rider QR & Confirm</span>
                      </button>
                    ) : isDelivered ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 bg-teal-100 px-3 py-1.5 rounded-lg border border-teal-300">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Delivered ✓</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => setSelectedDonationForScanner(don)}
                        className="flex items-center gap-1 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg shadow-2xs transition"
                      >
                        <Scan className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Scan QR</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ACTIVE TIME-LIMITED SURPLUS OFFERS */}
      {donations
        ?.flatMap((d) => (d.offers || []).map((o) => ({ offer: o, donation: d })))
        ?.filter(
          (item) =>
            item.offer.status === 'PENDING' &&
            (item.offer.recipientId === currentUser?.id ||
              item.offer.recipientId?._id === currentUser?.id ||
              item.offer.recipientId === currentUser?._id)
        )
        ?.map((item) => (
          <OfferBanner
            key={item.offer._id || item.offer.id}
            offer={item.offer}
            donation={item.donation}
            onAccepted={() => setSelectedDonationForClaim(item.donation)}
            onDeclined={() => {}}
          />
        ))}

      {/* PROMINENT SEARCH BAR & FILTERS */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search available meals by food name, donor kitchen, or location..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="matchScore_desc">Sort: Best Smart Match</option>
                <option value="priority_desc">Sort: Priority (High to Low)</option>
                <option value="expiry_asc">Sort: Expiring soonest</option>
                <option value="distance">Sort: Nearest distance</option>
              </select>
            </div>

            <div className="text-xs text-slate-500 font-medium shrink-0">
              Showing {sortedMatches.length} match(es)
            </div>
          </div>
        </div>

        {/* Priority Filter Chips & Dietary Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">
              Surplus Priority:
            </span>
            {[
              { id: 'HIGH', label: 'High Priority', color: 'border-rose-300 text-rose-700 bg-rose-50', active: 'bg-rose-600 text-white border-rose-600' },
              { id: 'MEDIUM', label: 'Medium', color: 'border-amber-300 text-amber-700 bg-amber-50', active: 'bg-amber-600 text-white border-amber-600' },
              { id: 'LOW', label: 'Low', color: 'border-emerald-300 text-emerald-700 bg-emerald-50', active: 'bg-emerald-600 text-white border-emerald-600' },
            ].map((chip) => {
              const isSelected = selectedPriorities.includes(chip.id);
              return (
                <button
                  key={chip.id}
                  onClick={() => togglePriorityFilter(chip.id)}
                  className={`px-3 py-1 rounded-full text-xs font-bold border transition whitespace-nowrap ${
                    isSelected ? chip.active : chip.color
                  }`}
                >
                  {isSelected ? '✓ ' : ''}{chip.label}
                </button>
              );
            })}
            {selectedPriorities.length > 0 && (
              <button
                onClick={() => setSelectedPriorities([])}
                className="text-[11px] text-slate-400 hover:text-slate-600 underline ml-1"
              >
                Clear
              </button>
            )}
          </div>

          {/* Dietary Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {[
              { id: 'ALL', label: 'All Dietary' },
              { id: 'veg', label: '🥦 Vegetarian' },
              { id: 'vegan', label: '🌱 100% Vegan' },
              { id: 'non_veg', label: '🍗 Non-Vegetarian' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setDietaryFilter(cat.id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  dietaryFilter === cat.id
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Smart Match Recommendations Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-bold text-slate-900">
              Smart-Match Recommendations
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            Ranked by Priority Match Boost • Proximity • Holding Window
          </span>
        </div>

        {sortedMatches.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto">
              <Home className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-800">No surplus donations match your filter</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || selectedPriorities.length > 0
                ? 'No batches matched current filters. Try resetting search query or priority filters.'
                : 'No active surplus donations currently available in this radius. Broadcast your food requirement above.'}
            </p>
            {searchQuery || selectedPriorities.length > 0 ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedPriorities([]);
                  setDietaryFilter('ALL');
                }}
                className="inline-flex items-center gap-1.5 bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-700 transition"
              >
                <span>Reset Filters</span>
              </button>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedMatches.map((match) => (
              <SpatialCard key={match.donation.id} maxTilt={6}>
                <MatchCard
                  match={match}
                  onClaim={(don) => setSelectedDonationForClaim(don)}
                />
              </SpatialCard>
            ))}
          </div>
        )}
      </div>

      {/* Recipient Active Requirements Log */}
      <div className="space-y-3 pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <span>Your Submitted Requirements ({requirements.length})</span>
          </h4>
          <span className="text-xs text-slate-500">
            Click Edit to modify open requirements
          </span>
        </div>

        {requirements.length === 0 ? (
          <p className="text-xs text-slate-500">No active requirements posted yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {requirements.map((req) => {
              const isOpen = !req.status || req.status === 'OPEN';
              return (
                <div key={req.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800">
                      {req.title || req.foodType?.replace('_', ' ').toUpperCase()}
                    </span>
                    <PriorityBadge priority={req.priority || req.urgency || 'MEDIUM'} compact />
                  </div>
                  <p className="text-xs text-slate-600">
                    Quantity needed: <strong>{req.quantityNeeded} {req.unit || 'plates'}</strong> ({req.dietaryPreference || 'any'})
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span className="truncate">Deliver to: {req.location || req.address?.city || 'Local area'}</span>
                    {isOpen && (
                      <button
                        onClick={() => {
                          setEditingRequirement(req);
                          setIsPostReqOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center gap-1 transition shrink-0"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* REVIEWS & COMMUNITY FEEDBACK SECTION */}
      <div className="pt-4 border-t border-slate-200">
        <ReviewsSection />
      </div>

      {/* Modals */}
      <PostRequirementModal
        isOpen={isPostReqOpen}
        onClose={() => {
          setIsPostReqOpen(false);
          setEditingRequirement(null);
        }}
        requirementToEdit={editingRequirement}
      />

      <AcceptModal
        isOpen={!!selectedDonationForClaim}
        onClose={() => setSelectedDonationForClaim(null)}
        donation={selectedDonationForClaim}
      />

      <QrCodeModal
        isOpen={!!selectedDonationForQr}
        onClose={() => setSelectedDonationForQr(null)}
        donation={selectedDonationForQr}
      />

      <RecipientQrScannerModal
        isOpen={!!selectedDonationForScanner}
        onClose={() => setSelectedDonationForScanner(null)}
        targetDonation={selectedDonationForScanner}
      />
    </div>
  );
};
