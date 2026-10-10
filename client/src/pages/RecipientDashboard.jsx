import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDonations } from '../context/DonationContext';
import { api } from '../services/api';
import { MatchCard } from '../components/recipient/MatchCard';
import { PostRequirementModal } from '../components/recipient/PostRequirementModal';
import { AcceptModal } from '../components/recipient/AcceptModal';
import { QrCodeModal } from '../components/common/QrCodeModal';
import {
  Home,
  Sparkles,
  PlusCircle,
  Clock,
  MapPin,
  AlertCircle,
  CheckCircle2,
  QrCode,
} from 'lucide-react';

export const RecipientDashboard = ({ isPostReqOpen, setIsPostReqOpen }) => {
  const { currentUser } = useAuth();
  const { donations, requirements } = useDonations();
  const [smartMatches, setSmartMatches] = useState([]);
  const [selectedDonationForClaim, setSelectedDonationForClaim] = useState(null);
  const [selectedDonationForQr, setSelectedDonationForQr] = useState(null);

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

  // Recipient's claimed active handovers
  const claimedDonations = donations.filter((d) =>
    d.matchedRecipients?.some(
      (m) => m.recipientId === currentUser?.id || m.recipientName?.includes('Grace Hope')
    )
  );

  return (
    <div className="space-y-6">
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
            Specify how many meals or food items your organization needs. Our proximity algorithm pairs you with verified restaurants and hotels before food quality degrades.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsPostReqOpen(true)}
              className="bg-white hover:bg-emerald-50 active:scale-95 text-emerald-900 font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-md transition flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4 text-emerald-700" />
              <span>+ Post Food Requirement</span>
            </button>
            <span className="text-xs text-emerald-200 font-medium">
              ⚡ {smartMatches.length} smart matches available nearby right now
            </span>
          </div>
        </div>
      </div>

      {/* Active Claimed Deliveries in Progress */}
      {claimedDonations.length > 0 && (
        <div className="bg-white rounded-2xl border border-indigo-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping" />
              <h4 className="font-bold text-sm text-slate-800">
                Your Active Claimed Donations (Awaiting Handover)
              </h4>
            </div>
            <span className="text-xs text-indigo-700 font-semibold bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
              {claimedDonations.length} Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {claimedDonations.map((don) => (
              <div
                key={don.id}
                className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800 truncate">{don.foodName}</div>
                  <div className="text-[11px] text-slate-500">
                    From {don.donorName} • Status: {don.status.replace(/_/g, ' ')}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDonationForQr(don)}
                  className="shrink-0 flex items-center gap-1 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg shadow-2xs transition"
                >
                  <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Show QR</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
            Ranked by Proximity • Expiry Urgency • Safe Holding Time
          </span>
        </div>

        {smartMatches.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
            No active surplus donations currently available in this radius. Check back shortly.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {smartMatches.map((match) => (
              <MatchCard
                key={match.donation.id}
                match={match}
                onClaim={(don) => setSelectedDonationForClaim(don)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recipient Active Requirements Log */}
      <div className="space-y-3 pt-4">
        <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-500" />
          <span>Your Submitted Requirements</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {requirements.map((req) => (
            <div key={req.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800">{req.foodType?.replace('_', ' ').toUpperCase()}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                  {req.urgency} URGENCY
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Quantity needed: <strong>{req.quantityNeeded} {req.unit}</strong> ({req.dietaryPreference})
              </p>
              <div className="text-[11px] text-slate-400">
                Deliver to: {req.location}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      <PostRequirementModal
        isOpen={isPostReqOpen}
        onClose={() => setIsPostReqOpen(false)}
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
    </div>
  );
};
