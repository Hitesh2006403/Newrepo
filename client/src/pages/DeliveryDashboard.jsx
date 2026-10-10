import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDonations } from '../context/DonationContext';
import { DeliveryTaskCard } from '../components/delivery/DeliveryTaskCard';
import { QrVerifyModal } from '../components/delivery/QrVerifyModal';
import { QrCodeModal } from '../components/common/QrCodeModal';
import { PorterDispatchModal } from '../components/delivery/PorterDispatchModal';
import { ReviewsSection } from '../components/common/ReviewsSection';
import {
  Bike,
  Truck,
  ShieldCheck,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Radio,
  Zap,
  Navigation,
  Compass,
  ArrowRight,
  Sparkles,
  Phone,
} from 'lucide-react';

export const DeliveryDashboard = () => {
  const { currentUser } = useAuth();
  const {
    deliveryTasks,
    updateDeliveryMilestone,
    claimDeliveryTask,
    donations,
  } = useDonations();

  // Rider duty status
  const [isOnline, setIsOnline] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState('2_WHEELER');

  // Modals state
  const [selectedTaskForPickupScan, setSelectedTaskForPickupScan] = useState(null);
  const [selectedDonationForReceiptQr, setSelectedDonationForReceiptQr] = useState(null);
  const [explicitReceiptToken, setExplicitReceiptToken] = useState(null);
  const [porterModalTask, setPorterModalTask] = useState(null);
  const [isPorterModalOpen, setIsPorterModalOpen] = useState(false);

  // Filter tasks into categories:
  // 1. Open Available Orders (Marketplace feed awaiting driver claim)
  const openAvailableTasks = deliveryTasks.filter(
    (t) => t.currentMilestone === 'OPEN_FOR_PICKUP'
  );

  // 2. Assigned Active Deliveries
  const activeTasks = deliveryTasks.filter(
    (t) => t.currentMilestone !== 'DELIVERED' && t.currentMilestone !== 'OPEN_FOR_PICKUP'
  );

  // 3. Completed Rescues
  const completedTasks = deliveryTasks.filter((t) => t.currentMilestone === 'DELIVERED');

  const handleOpenReceiptQr = (task, token) => {
    const matchingDonation = donations.find((d) => d.id === task.donationId) || {
      id: task.donationId,
      foodName: task.foodName,
      status: 'PICKED_UP',
    };
    setSelectedDonationForReceiptQr(matchingDonation);
    setExplicitReceiptToken(token || null);
  };

  const handleOpenPorterModal = (task = null) => {
    setPorterModalTask(task);
    setIsPorterModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Rider Status & Porter Hybrid Dispatch Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl border border-slate-800">
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 px-3 py-1 rounded-full text-xs font-bold">
                <Bike className="w-3.5 h-3.5" />
                <span>Delivery Fleet Hub • {currentUser?.name || 'Vikram Singh (Rider #42)'}</span>
              </div>

              {/* Porter Hybrid Integration Badge */}
              <div className="inline-flex items-center gap-1.5 bg-amber-400/20 text-amber-300 border border-amber-400/40 px-3 py-1 rounded-full text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Porter Enterprise Integration Active</span>
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Rapid Food Rescue Logistics Portal
            </h2>
            <p className="text-xs sm:text-sm text-blue-100/80 leading-relaxed">
              Our in-house driver portal works alongside <strong>Porter On-Demand Logistics</strong>. Claim available local pickups, scan Stage 1 Donor QR codes, and deliver hot food directly to verified shelters.
            </p>

            {/* Duty & Stats Bar */}
            <div className="pt-2 flex flex-wrap items-center gap-3 text-xs font-semibold">
              <span className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-1.5">
                🛵 Vehicle: <strong>Electric Cargo Scooter (KA-01-EQ-9872)</strong>
              </span>
              <span className="bg-emerald-900/60 text-emerald-200 px-3 py-1.5 rounded-xl border border-emerald-700/50">
                ⭐ Rating: <strong>4.95 / 5.0</strong>
              </span>
              <span className="bg-blue-900/60 text-blue-200 px-3 py-1.5 rounded-xl border border-blue-700/50">
                🎁 Volunteer Payout: <strong>₹95 / trip</strong>
              </span>
            </div>
          </div>

          {/* Porter-style Duty Toggle & Porter Dispatch Button */}
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 w-full sm:w-auto shrink-0 flex flex-col gap-3">
            {/* Duty Status Switch */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`}></span>
                <span className="text-xs font-black uppercase tracking-wider">
                  {isOnline ? 'Duty: Online (Ready)' : 'Duty: Offline (Rest)'}
                </span>
              </div>
              <button
                onClick={() => setIsOnline(!isOnline)}
                className={`px-3 py-1 rounded-xl text-xs font-black transition ${
                  isOnline
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950'
                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
              >
                {isOnline ? 'Go Offline' : 'Go Online'}
              </button>
            </div>

            <div className="border-t border-white/10 pt-3">
              <button
                onClick={() => handleOpenPorterModal(null)}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2"
              >
                <Truck className="w-4 h-4" />
                <span>Dispatch via Porter Fleet</span>
              </button>
              <div className="text-[10px] text-blue-200/70 text-center mt-1">
                Dispatch 2-Wheelers, 3-Wheelers & Tata Ace mini-trucks
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Available Deliveries Radar (Marketplace dispatch feed like Porter Partner) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-600 animate-pulse" />
            <h3 className="text-lg font-bold text-slate-900">
              Nearby Pickups Radar
            </h3>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-full">
              {openAvailableTasks.length} Broadcasted
            </span>
          </div>
          <span className="text-xs text-slate-500">Live Radius: 5.0 km</span>
        </div>

        {openAvailableTasks.length === 0 ? (
          <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500 text-xs">
            No unassigned pickups broadcasted right now. All current rescue requests have been assigned to active drivers or Porter couriers.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {openAvailableTasks.map((task) => (
              <DeliveryTaskCard
                key={task.id}
                task={task}
                onUpdateStatus={(taskId, milestone) => updateDeliveryMilestone(taskId, milestone)}
                onClaimTask={(taskId) => claimDeliveryTask(taskId, { agentId: currentUser?.email || 'user-delivery-1' })}
                onOpenPickupScan={(t) => setSelectedTaskForPickupScan(t)}
                onOpenReceiptQr={(t) => handleOpenReceiptQr(t)}
                onOpenPorterModal={(t) => handleOpenPorterModal(t)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Assigned Active Deliveries */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>Your Active Delivery Runs</span>
            <span className="text-xs bg-amber-100 text-amber-800 font-extrabold px-2.5 py-0.5 rounded-full">
              {activeTasks.length} In Progress
            </span>
          </h3>
          <span className="text-xs text-slate-500">Stages 1 & 2 QR Protected</span>
        </div>

        {activeTasks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
            You currently have no active deliveries in progress. Accept an open pickup from the radar above or take a break!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeTasks.map((task) => (
              <DeliveryTaskCard
                key={task.id}
                task={task}
                onUpdateStatus={(taskId, milestone) => updateDeliveryMilestone(taskId, milestone)}
                onClaimTask={(taskId) => claimDeliveryTask(taskId)}
                onOpenPickupScan={(t) => setSelectedTaskForPickupScan(t)}
                onOpenReceiptQr={(t) => handleOpenReceiptQr(t)}
                onOpenPorterModal={(t) => handleOpenPorterModal(t)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Completed Runs */}
      {completedTasks.length > 0 && (
        <div className="space-y-3 pt-6 border-t border-slate-200">
          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
            <span>Completed Rescues Today</span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completedTasks.map((task) => (
              <DeliveryTaskCard
                key={task.id}
                task={task}
                onUpdateStatus={() => {}}
                onOpenPickupScan={() => {}}
                onOpenReceiptQr={() => {}}
                onOpenPorterModal={() => {}}
              />
            ))}
          </div>
        </div>
      )}

      {/* REVIEWS & COMMUNITY FEEDBACK */}
      <div className="pt-4 border-t border-slate-200">
        <ReviewsSection />
      </div>

      {/* STAGE 1: Pickup QR Verify Scanner Modal */}
      <QrVerifyModal
        isOpen={!!selectedTaskForPickupScan}
        onClose={() => setSelectedTaskForPickupScan(null)}
        task={selectedTaskForPickupScan}
        onOpenReceiptQr={(task, token) => handleOpenReceiptQr(task, token)}
      />

      {/* STAGE 2: Recipient Receipt QR Code Modal (Presented by Rider to Shelter) */}
      <QrCodeModal
        isOpen={!!selectedDonationForReceiptQr}
        onClose={() => {
          setSelectedDonationForReceiptQr(null);
          setExplicitReceiptToken(null);
        }}
        donation={selectedDonationForReceiptQr}
        stage="RECEIPT"
        explicitToken={explicitReceiptToken}
      />

      {/* PORTER ON-DEMAND DISPATCH MODAL */}
      <PorterDispatchModal
        isOpen={isPorterModalOpen}
        onClose={() => setIsPorterModalOpen(false)}
        task={porterModalTask}
        donation={donations[0]}
        onSuccess={() => setIsPorterModalOpen(false)}
      />
    </div>
  );
};
