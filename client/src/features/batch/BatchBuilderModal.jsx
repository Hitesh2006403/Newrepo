import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Bike,
  Truck,
  Car,
  CarFront,
  Navigation,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Package,
} from 'lucide-react';
import { api } from '../../services/api';

/**
 * BatchBuilderModal
 * Allows a delivery agent or coordinator to combine 2-3 compatible tasks
 * into a co-routed multi-stop batch run with real-time feasibility preview.
 */
export const BatchBuilderModal = ({
  isOpen,
  onClose,
  availableTasks = [],
  onBatchCreated,
}) => {
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [vehicleType, setVehicleType] = useState('2_WHEELER');
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [creatingBatch, setCreatingBatch] = useState(false);
  const [error, setError] = useState(null);

  // Pre-select first 2 tasks if available when modal opens
  useEffect(() => {
    if (isOpen && availableTasks.length >= 2 && selectedTaskIds.length === 0) {
      setSelectedTaskIds([availableTasks[0].id || availableTasks[0]._id, availableTasks[1].id || availableTasks[1]._id]);
    }
  }, [isOpen, availableTasks]);

  // Recalculate preview whenever selection or vehicleType changes
  useEffect(() => {
    if (selectedTaskIds.length >= 2) {
      handlePreviewRoute();
    } else {
      setPreview(null);
      setError(null);
    }
  }, [selectedTaskIds, vehicleType]);

  const handlePreviewRoute = async () => {
    setLoadingPreview(true);
    setError(null);
    try {
      const result = await api.previewBatchRoute({
        taskIds: selectedTaskIds,
        vehicleType,
      });
      setPreview(result);
    } catch (err) {
      setError(err.message || 'Selected tasks cannot be co-routed');
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const toggleTaskSelection = (taskId) => {
    if (selectedTaskIds.includes(taskId)) {
      setSelectedTaskIds(selectedTaskIds.filter((id) => id !== taskId));
    } else {
      if (selectedTaskIds.length >= 3) {
        return; // Max 3 tasks
      }
      setSelectedTaskIds([...selectedTaskIds, taskId]);
    }
  };

  const handleCreateBatch = async () => {
    setCreatingBatch(true);
    setError(null);
    try {
      const newBatch = await api.createDeliveryBatch({
        taskIds: selectedTaskIds,
        vehicleType,
      });
      if (onBatchCreated) {
        onBatchCreated(newBatch);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create delivery batch');
    } finally {
      setCreatingBatch(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Build Multi-Stop Batch Run
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Co-route 2 to 3 pickups to optimize fuel, travel time & earnings
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Vehicle Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Select Your Transport Vehicle
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { type: '2_WHEELER', label: '2-Wheeler', cap: '20 plates', icon: Bike },
                { type: '3_WHEELER', label: '3-Wheeler', cap: '60 plates', icon: CarFront },
                { type: '4_WHEELER', label: '4-Wheeler', cap: '150 plates', icon: Car },
                { type: 'TRUCK', label: 'Mini Truck', cap: '500 plates', icon: Truck },
              ].map((veh) => {
                const Icon = veh.icon;
                const isSelected = vehicleType === veh.type;
                return (
                  <button
                    key={veh.type}
                    type="button"
                    onClick={() => setVehicleType(veh.type)}
                    className={`p-3 rounded-2xl border text-left transition ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 shadow-sm ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="w-5 h-5 mb-1 text-blue-600 dark:text-blue-400" />
                    <div className="text-xs font-extrabold">{veh.label}</div>
                    <div className="text-[10px] text-slate-500">{veh.cap}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Task Picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Select Tasks to Combine ({selectedTaskIds.length} / 3 selected)
              </label>
              <span className="text-[11px] text-slate-400">Min 2, Max 3 tasks</span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {availableTasks.map((t) => {
                const id = t.id || t._id;
                const isSelected = selectedTaskIds.includes(id);
                return (
                  <div
                    key={id}
                    onClick={() => toggleTaskSelection(id)}
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{t.foodName}</span>
                        <span className="text-[11px] text-slate-500 font-normal">
                          • {t.quantity}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-sm">
                        Pickup: {t.pickup?.location}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-emerald-600">
                        ₹{(t.payout || 0) + (t.deliveryFee || 0)}
                      </span>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Feasibility & Route Preview */}
          {preview && (
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Feasibility Confirmed</span>
                </span>
                <span>{preview.stops.length} Waypoints Sequence</span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                  <div className="text-[10px] text-slate-500">Total Distance</div>
                  <div className="text-sm font-black text-slate-800 dark:text-slate-200">
                    {preview.metrics.totalDistanceKm} km
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                  <div className="text-[10px] text-slate-500">Estimated Duration</div>
                  <div className="text-sm font-black text-slate-800 dark:text-slate-200">
                    ~{preview.metrics.totalEstimatedMinutes} min
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                  <div className="text-[10px] text-slate-500">Combined Payout</div>
                  <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    ₹{(preview.metrics.totalPayout || 0) + (preview.metrics.totalDeliveryFee || 0)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selectedTaskIds.length < 2 || !preview || creatingBatch}
            onClick={handleCreateBatch}
            className="py-2.5 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs rounded-xl shadow-lg transition flex items-center gap-2 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>{creatingBatch ? 'Forming Batch...' : 'Create Verified Batch'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchBuilderModal;
