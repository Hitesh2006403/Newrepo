import { PriorityBadge } from '../common/PriorityBadge';
import {
  MapPin,
  Phone,
  Navigation,
  QrCode,
  ShieldAlert,
  CheckCircle2,
  Bike,
  ArrowRight,
  Scan,
} from 'lucide-react';

export const DeliveryTaskCard = ({
  task,
  onUpdateStatus,
  onOpenPickupScan,
  onOpenReceiptQr,
  onClaimTask,
  onOpenPorterModal,
  onSettleFee,
}) => {
  const isDelivered = task.currentMilestone === 'DELIVERED';
  const isPickedUp = task.currentMilestone === 'PICKED_UP';
  const isOpenForPickup = task.currentMilestone === 'OPEN_FOR_PICKUP';
  const isPickupStage = !isPickedUp && !isDelivered && !isOpenForPickup;
  const isPorter = task.deliveryProvider === 'PORTER';

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between">
      <div>
        {/* Top Header */}
        <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                isPorter ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'
              }`}
            >
              {isPorter ? <span className="text-base">🚚</span> : <Bike className="w-4 h-4" />}
            </span>
            <div>
              <div className="text-xs font-bold text-slate-800">{task.foodName}</div>
              <div className="text-[11px] text-slate-500">
                {task.quantity} • {task.storageCondition}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <PriorityBadge priority={task.priority} />
            {isPorter && (
              <span className="text-[9px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-md uppercase tracking-wider shadow-xs">
                Porter Fleet
              </span>
            )}
            {task.settled ? (
              <span className="text-[9px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-md uppercase tracking-wider shadow-xs">
                ✓ Settled
              </span>
            ) : task.deliveryFee > 0 && task.payerMode !== 'NONE' ? (
              <span className="text-[9px] font-black bg-blue-100 text-blue-800 border border-blue-300 px-2 py-0.5 rounded-md uppercase tracking-wider">
                💰 ₹{task.deliveryFee}
              </span>
            ) : (
              <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md uppercase tracking-wider">
                🌱 Volunteer
              </span>
            )}
            <span
              className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                isDelivered
                  ? 'bg-teal-100 text-teal-800 border border-teal-300'
                  : isPickedUp
                  ? 'bg-purple-100 text-purple-800 border border-purple-300'
                  : isOpenForPickup
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {task.currentMilestone.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        {/* Route Steps */}
        <div className="p-4 space-y-4">
          {/* Pickup Point */}
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Pickup Location (Donor)</div>
              <div className="text-xs font-semibold text-slate-800 truncate">{task.pickup?.donorName}</div>
              <div className="text-xs text-slate-500 truncate">{task.pickup?.location}</div>
              <a
                href={`tel:${task.pickup?.donorPhone}`}
                className="inline-flex items-center gap-1 text-[11px] text-rose-600 hover:underline mt-0.5"
              >
                <Phone className="w-3 h-3" />
                <span>Call Kitchen ({task.pickup?.donorPhone})</span>
              </a>
            </div>
          </div>

          {/* Drop-off Point */}
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
              <Navigation className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Drop-off Shelter (Recipient)</div>
              <div className="text-xs font-semibold text-slate-800 truncate">{task.dropoff?.recipientName}</div>
              <div className="text-xs text-slate-500 truncate">{task.dropoff?.location}</div>
              <a
                href={`tel:${task.dropoff?.recipientPhone}`}
                className="inline-flex items-center gap-1 text-[11px] text-emerald-600 hover:underline mt-0.5"
              >
                <Phone className="w-3 h-3" />
                <span>Call Recipient ({task.dropoff?.recipientPhone})</span>
              </a>
            </div>
          </div>

          {/* Thermal Container Advice & Fee info */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2.5 text-[11px] text-amber-900 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Load: {task.vehicleSuggestion || 'Use insulated delivery carrier'}</span>
            </div>
            {task.deliveryFee > 0 && task.payerMode !== 'NONE' ? (
              <span className="font-extrabold text-blue-800 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-md text-[10px] shrink-0">
                ₹{task.deliveryFee} Stipend ({task.payerMode === 'SPLIT' ? 'Split 50/50' : task.payerMode === 'DONOR' ? 'Donor' : 'Recipient'})
              </span>
            ) : (
              <span className="font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md text-[10px] shrink-0">
                🌱 Volunteer Run (₹0 Fee)
              </span>
            )}
          </div>

          {/* Porter Details Banner if Dispatched via Porter */}
          {isPorter && task.porterDetails && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs space-y-2">
              <div className="flex items-center justify-between font-bold text-indigo-950">
                <span className="flex items-center gap-1.5">
                  <span>🚚</span>
                  <span>{task.porterDetails.driverName || 'Porter Assigned Driver'}</span>
                </span>
                <span className="font-mono text-[11px] text-indigo-700">{task.porterDetails.crn}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span>Vehicle: <strong className="text-slate-800">{task.porterDetails.vehicleNumber}</strong></span>
                {task.porterDetails.fare && <span>Fare: <strong className="text-emerald-700">₹{task.porterDetails.fare}</strong></span>}
              </div>
              {task.porterDetails.trackingUrl && (
                <a
                  href={task.porterDetails.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-lg flex items-center justify-center gap-1.5 transition shadow-xs"
                >
                  <span>Track Porter Live GPS</span>
                  <ArrowRight className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Milestones */}
      <div className="p-4 pt-0 space-y-2">
        {/* Open For Pickup: Rider can Accept or Delegate to Porter */}
        {isOpenForPickup && (
          <div className="space-y-2">
            <button
              onClick={() => onClaimTask && onClaimTask(task.id, { feeVersion: task.feeVersion, expectedFeeVersion: task.feeVersion })}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-md transition flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {task.deliveryFee > 0 && task.payerMode !== 'NONE'
                  ? `Accept Delivery Job (₹${task.deliveryFee} Stipend)`
                  : 'Accept Volunteer Delivery (Food-Only)'}
              </span>
            </button>
            {onOpenPorterModal && (
              <button
                onClick={() => onOpenPorterModal(task)}
                className="w-full py-2 px-3 rounded-xl border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold text-xs transition flex items-center justify-center gap-1.5"
              >
                <span>Delegate to Porter Fleet</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Stage 1 Pickup Scanner Action */}
        {isPickupStage && (
          <div className="space-y-2">
            <button
              onClick={() => onOpenPickupScan(task)}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
            >
              <Scan className="w-4 h-4" />
              <span>Scan Donor Pickup QR Code</span>
            </button>
            {!isPorter && onOpenPorterModal && (
              <button
                onClick={() => onOpenPorterModal(task)}
                className="w-full py-1.5 text-[11px] text-indigo-700 hover:underline text-center block font-semibold"
              >
                Need backup? Re-dispatch with Porter Mini-Truck →
              </button>
            )}
          </div>
        )}

        {/* Stage 2 In-Transit: Show Receipt QR to Shelter */}
        {isPickedUp && (
          <button
            onClick={() => onOpenReceiptQr(task)}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-teal-600 hover:from-purple-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            <span>Show Recipient Receipt QR Code (Stage 2)</span>
          </button>
        )}

        {isDelivered && (
          <div className="space-y-2">
            <div className="w-full py-2 px-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-teal-600" />
              <span>Handover Complete & Food Rescued!</span>
            </div>
            {task.deliveryFee > 0 && !task.settled && onSettleFee && (
              <button
                type="button"
                onClick={() => onSettleFee(task)}
                className="w-full py-1.5 px-3 rounded-xl bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-900 text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <span>Mark ₹{task.deliveryFee} Fee Settled (External)</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
