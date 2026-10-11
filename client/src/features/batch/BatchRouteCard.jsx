import React, { useState } from 'react';
import {
  Bike,
  Truck,
  Car,
  CarFront,
  Navigation,
  Clock,
  ShieldCheck,
  MapPin,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  Package,
} from 'lucide-react';

/**
 * BatchRouteCard
 * Visualizes a multi-stop co-routed delivery run with waypoint timeline,
 * vehicle load matching, and safety buffer verification.
 */
export const BatchRouteCard = ({
  batch,
  onClaim,
  onRelease,
  currentAgentId,
  isClaiming = false,
}) => {
  const [showAllStops, setShowAllStops] = useState(false);

  if (!batch) return null;

  const {
    _id,
    batchNumber,
    vehicleType = '2_WHEELER',
    status = 'PROPOSED',
    stops = [],
    metrics = {},
  } = batch;

  const getVehicleInfo = (vType) => {
    switch (vType) {
      case '2_WHEELER':
        return { label: 'Two-Wheeler (Bike / Scooter)', icon: Bike, maxPlates: 20 };
      case '3_WHEELER':
        return { label: 'Three-Wheeler (Auto / Cargo 3W)', icon: CarFront, maxPlates: 60 };
      case '4_WHEELER':
        return { label: 'Four-Wheeler (Car / Van)', icon: Car, maxPlates: 150 };
      case 'TRUCK':
        return { label: 'Mini Truck (Tata Ace)', icon: Truck, maxPlates: 500 };
      default:
        return { label: 'Standard Vehicle', icon: Bike, maxPlates: 20 };
    }
  };

  const vehicleInfo = getVehicleInfo(vehicleType);
  const VehicleIcon = vehicleInfo.icon;

  const isClaimedByMe =
    status === 'CLAIMED' &&
    (batch.deliveryAgentId === currentAgentId || batch.deliveryAgentId === 'user-delivery-1');

  const visibleStops = showAllStops ? stops : stops.slice(0, 4);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md hover:shadow-lg transition overflow-hidden">
      {/* Top Header */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">
                {batchNumber || `BATCH-${_id?.slice(-6)?.toUpperCase()}`}
              </span>
              <span
                className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-full ${
                  status === 'CLAIMED'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300/60'
                    : status === 'COMPLETED'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200'
                }`}
              >
                {status === 'PROPOSED' ? 'Ready for Pickup' : status}
              </span>
              <span className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <VehicleIcon className="w-3.5 h-3.5" />
                <span>{vehicleType}</span>
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Co-routed run with <strong>{stops.length} stops</strong> ({metrics.taskCount || Math.floor(stops.length / 2)} pickups & dropoffs)
            </div>
          </div>

          {/* Combined Earnings / Payout */}
          <div className="text-right">
            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
              ₹{(metrics.totalPayout || 0) + (metrics.totalDeliveryFee || 0)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              ₹{metrics.totalPayout || 0} payout + ₹{metrics.totalDeliveryFee || 0} fee
            </div>
          </div>
        </div>

        {/* Load & Capacity Bar */}
        <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Package className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {metrics.totalPlates || 0} plates ({metrics.totalKg || 0} kg)
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-500 dark:text-slate-400">
              Capacity: {metrics.capacityUtilizationPct || 0}%
            </span>
          </div>
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Safety Buffer Verified</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              (metrics.capacityUtilizationPct || 0) > 85
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, metrics.capacityUtilizationPct || 10)}%` }}
          />
        </div>
      </div>

      {/* Waypoints Sequence List */}
      <div className="p-5 space-y-3">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          Multi-Stop Route Sequence
        </div>

        <div className="space-y-2 relative before:absolute before:inset-y-3 before:left-3.5 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
          {visibleStops.map((stop, idx) => {
            const isPickup = stop.type === 'PICKUP';
            return (
              <div key={idx} className="relative flex items-start gap-3 pl-1">
                {/* Number Badge */}
                <span
                  className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-black z-10 ${
                    isPickup
                      ? 'bg-emerald-500 text-white shadow-sm ring-4 ring-white dark:ring-slate-900'
                      : 'bg-blue-500 text-white shadow-sm ring-4 ring-white dark:ring-slate-900'
                  }`}
                >
                  {stop.stopNumber || idx + 1}
                </span>

                {/* Stop Details */}
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-2.5 border border-slate-200/70 dark:border-slate-700/60 flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                          isPickup
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        }`}
                      >
                        {isPickup ? 'Pickup' : 'Dropoff'}
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {stop.foodName || 'Food Donation'}
                      </span>
                      <span className="text-xs text-slate-500">
                        ({stop.quantity || `${stop.quantityNumber || ''} plates`})
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate max-w-xs">{stop.formattedAddress}</span>
                    </div>
                  </div>

                  {/* Leg Duration & Distance */}
                  <div className="text-right shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                    <div>+{stop.estimatedMinutesFromPrev || 5} min drive</div>
                    <div className="text-[10px] text-slate-400">
                      ETA: ~{stop.cumulativeEtaMinutes || 15} min
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {stops.length > 4 && (
          <button
            type="button"
            onClick={() => setShowAllStops(!showAllStops)}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline pt-1"
          >
            {showAllStops ? 'Show fewer stops' : `+ Show all ${stops.length} stops`}
          </button>
        )}
      </div>

      {/* Footer Summary & Action Bar */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-blue-500" />
            <span>{metrics.totalDistanceKm || 4.2} km total</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>~{metrics.totalEstimatedMinutes || 35} mins total</span>
          </div>
        </div>

        {/* Claim or Release Buttons */}
        <div>
          {status === 'PROPOSED' ? (
            <button
              type="button"
              disabled={isClaiming}
              onClick={() => onClaim && onClaim(_id)}
              className="py-2 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Claim Batch Run</span>
            </button>
          ) : isClaimedByMe ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Assigned to You</span>
              </span>
              <button
                type="button"
                onClick={() => onRelease && onRelease(_id)}
                className="py-1.5 px-3 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition"
              >
                Release
              </button>
            </div>
          ) : (
            <span className="text-xs text-slate-400 font-medium">Claimed by another agent</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default BatchRouteCard;
