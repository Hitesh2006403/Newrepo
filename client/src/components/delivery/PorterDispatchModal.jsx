import React, { useState, useEffect } from 'react';
import {
  Truck,
  Bike,
  X,
  MapPin,
  Navigation,
  Phone,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../services/api';

export const PorterDispatchModal = ({
  isOpen,
  onClose,
  task,
  donation,
  onSuccess,
}) => {
  const [vehicleType, setVehicleType] = useState('3_WHEELER');
  const [estimateData, setEstimateData] = useState(null);
  const [loadingEstimate, setLoadingEstimate] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookedResult, setBookedResult] = useState(null);

  const pickupLocation = task?.pickup?.location || donation?.pickupAddress?.street || 'Indiranagar 100ft Road, Bengaluru';
  const dropoffLocation = task?.dropoff?.location || 'Sunshine Children Home, Koramangala';
  const foodName = task?.foodName || donation?.foodName || 'Surplus Nutritious Meal Boxes';
  const quantity = task?.quantity || (donation ? `${donation.remainingQuantity} ${donation.unit}` : '80 servings');

  useEffect(() => {
    if (isOpen) {
      setBookedResult(null);
      setLoadingEstimate(true);
      const servings = parseInt(quantity, 10) || 50;

      api
        .getPorterEstimate({
          pickupLocation,
          dropoffLocation,
          quantityServings: servings,
          distanceKm: task?.distanceTotalKm || 4.5,
        })
        .then((res) => {
          setEstimateData(res);
          if (res?.recommendedVehicle) {
            setVehicleType(res.recommendedVehicle);
          }
          setLoadingEstimate(false);
        })
        .catch(() => {
          setLoadingEstimate(false);
        });
    }
  }, [isOpen, task, donation, pickupLocation, dropoffLocation, quantity]);

  if (!isOpen) return null;

  const handleConfirmDispatch = async () => {
    setBookingLoading(true);
    try {
      const res = await api.bookPorterDelivery({
        taskId: task?.id,
        donationId: task?.donationId || donation?.id,
        vehicleType,
        pickup: task?.pickup || {
          location: pickupLocation,
          donorName: donation?.donorName || 'Verified Partner Kitchen',
          donorPhone: donation?.donorPhone || '+91 98765 43210',
        },
        dropoff: task?.dropoff || {
          location: dropoffLocation,
          recipientName: 'Community Shelter Drop-off',
          recipientPhone: '+91 91234 56789',
        },
        instructions: `Food Rescue: Handle ${quantity} of ${foodName} with care. Food hygiene sealed containers.`,
      });

      setBookedResult(res.booking);
      if (onSuccess) onSuccess(res);
    } catch (err) {
      alert('Porter dispatch error: ' + err.message);
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="inline-flex items-center gap-1.5 bg-amber-400 text-slate-900 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full mb-2 tracking-wider">
            <Sparkles className="w-3 h-3 fill-slate-900" />
            <span>Porter Enterprise Logistics API</span>
          </div>
          <h3 className="text-xl font-black tracking-tight">On-Demand Porter Dispatch</h3>
          <p className="text-xs text-blue-100/90 mt-1">
            Dispatch an on-demand Porter courier when in-house volunteer drivers are occupied.
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {bookedResult ? (
            /* Porter Booking Confirmation Success View */
            <div className="space-y-4 animate-in zoom-in-95 duration-200">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center space-y-2">
                <div className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-emerald-950">Porter Driver Dispatched!</h4>
                <p className="text-xs text-emerald-800">
                  CRN Reference: <span className="font-mono font-bold">{bookedResult.crn}</span>
                </p>
              </div>

              {/* Driver Details Card */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div>
                    <div className="text-xs text-slate-500 font-semibold">Assigned Porter Driver</div>
                    <div className="text-sm font-bold text-slate-900">{bookedResult.driverName}</div>
                  </div>
                  <a
                    href={`tel:${bookedResult.driverPhone}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call Driver</span>
                  </a>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">Vehicle Number:</span>
                    <span className="font-mono font-bold text-slate-800">{bookedResult.vehicleNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Est. Arrival at Pickup:</span>
                    <span className="font-bold text-blue-700">~{bookedResult.etaMinutes || 10} Minutes</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Fare (Subsidized):</span>
                    <span className="font-bold text-emerald-700">₹{bookedResult.fare || 155}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Consignment Status:</span>
                    <span className="font-bold text-amber-700">Driver En Route</span>
                  </div>
                </div>

                <a
                  href={bookedResult.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition"
                >
                  <span>Open Live Porter GPS Tracking Map</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ) : (
            /* Vehicle Selection & Fare Estimate */
            <>
              {/* Trip Summary Card */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2.5 text-xs">
                <div className="font-bold text-slate-800 flex items-center justify-between">
                  <span>{foodName}</span>
                  <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md font-extrabold">{quantity}</span>
                </div>

                <div className="space-y-1.5 pt-1 text-slate-600">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                    <span className="truncate">From: {pickupLocation}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Navigation className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="truncate">To: {dropoffLocation}</span>
                  </div>
                </div>
              </div>

              {/* Vehicle Options */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-800 block">
                  Select Porter Fleet Vehicle Type:
                </label>

                {loadingEstimate ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    <div className="inline-block animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full mb-2"></div>
                    <div>Calculating Porter delivery distance & live fare estimates...</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {estimateData?.vehicles?.map((v) => {
                      const isSelected = vehicleType === v.vehicleType;
                      return (
                        <div
                          key={v.vehicleType}
                          onClick={() => setVehicleType(v.vehicleType)}
                          className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{v.icon}</span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900">{v.displayName}</span>
                                {v.isRecommended && (
                                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                                    Recommended
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">{v.capacityDescription}</div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-sm font-black text-slate-900">₹{v.estimatedFare}</div>
                            <div className="text-[10px] text-slate-400">ETA: {v.etaMinutes}m</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Food Rescue Subsidy Notice */}
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Automatic Food Rescue Subsidy (15% OFF):</strong> Porter enterprise charitable rate applies to prevent food wastage in city bounds.
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition"
          >
            {bookedResult ? 'Done' : 'Cancel'}
          </button>
          {!bookedResult && (
            <button
              onClick={handleConfirmDispatch}
              disabled={bookingLoading}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md flex items-center gap-2 disabled:opacity-50"
            >
              {bookingLoading ? (
                <>
                  <div className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full"></div>
                  <span>Booking Porter Rider...</span>
                </>
              ) : (
                <>
                  <Truck className="w-4 h-4" />
                  <span>Confirm Porter Dispatch</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
