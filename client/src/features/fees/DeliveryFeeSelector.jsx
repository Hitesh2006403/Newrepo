import React, { useState, useEffect } from 'react';
import { ShieldCheck, Info, Check, Sparkles, HeartHandshake, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';

/**
 * DeliveryFeeSelector
 * Component for selecting delivery fee arrangement:
 * - NONE: Volunteer / Free food-only (₹0)
 * - DONOR: Donor covers delivery fee
 * - RECIPIENT: Recipient covers delivery fee
 * - SPLIT: 50/50 Split between donor & recipient
 *
 * Enforces platform cap (₹500), displays server-suggested estimate based on route,
 * and highlights external direct settlement disclaimer.
 */
export const DeliveryFeeSelector = ({
  acceptanceId,
  distanceKm = 3.5,
  initialPayerMode = 'NONE',
  initialAmount = 0,
  userRole = 'recipient',
  disabled = false,
  onChange,
}) => {
  const [payerMode, setPayerMode] = useState(initialPayerMode);
  const [amount, setAmount] = useState(initialAmount);
  const [suggestedFee, setSuggestedFee] = useState(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);

  useEffect(() => {
    if (acceptanceId) {
      setLoadingSuggestion(true);
      api
        .getSuggestedDeliveryFee(acceptanceId)
        .then((res) => {
          if (res) {
            setSuggestedFee(res);
            if (initialAmount === 0 && res.suggestedAmount && payerMode !== 'NONE') {
              setAmount(res.suggestedAmount);
              onChange?.({ payerMode, amount: res.suggestedAmount });
            }
          }
          setLoadingSuggestion(false);
        })
        .catch(() => {
          setLoadingSuggestion(false);
        });
    } else {
      // Offline / default estimate based on route distance
      const dist = distanceKm || 3.5;
      const base = 40;
      const perKm = 12;
      const calc = Math.min(500, Math.round(base + dist * perKm));
      setSuggestedFee({
        suggestedAmount: calc,
        distanceKm: dist,
        maxAmount: 500,
      });
      if (initialAmount === 0 && payerMode !== 'NONE') {
        setAmount(calc);
      }
    }
  }, [acceptanceId, distanceKm]);

  const handleModeChange = (newMode) => {
    if (disabled) return;
    setPayerMode(newMode);
    let newAmount = amount;
    if (newMode === 'NONE') {
      newAmount = 0;
      setAmount(0);
    } else if (amount === 0 && suggestedFee?.suggestedAmount) {
      newAmount = suggestedFee.suggestedAmount;
      setAmount(suggestedFee.suggestedAmount);
    }
    onChange?.({ payerMode: newMode, amount: newAmount });
  };

  const handleAmountChange = (newAmount) => {
    if (disabled) return;
    const clamped = Math.max(0, Math.min(500, Number(newAmount) || 0));
    setAmount(clamped);
    onChange?.({ payerMode, amount: clamped });
  };

  const myPayerOption = userRole === 'donor' ? 'DONOR' : 'RECIPIENT';
  const myPayerLabel = userRole === 'donor' ? 'Donor Covers Full Fee' : 'Recipient Covers Full Fee';
  const otherPayerOption = userRole === 'donor' ? 'RECIPIENT' : 'DONOR';
  const otherPayerLabel = userRole === 'donor' ? 'Recipient Covers Fee' : 'Donor Covers Fee';

  return (
    <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HeartHandshake className="w-4 h-4 text-emerald-600" />
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Delivery Fee Agreement
          </h4>
        </div>
        {suggestedFee && (
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-600" />
            Route Suggested: ₹{suggestedFee.suggestedAmount} ({suggestedFee.distanceKm} km)
          </span>
        )}
      </div>

      {/* Mode selection buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {/* Volunteer Free Option */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleModeChange('NONE')}
          className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 ${
            payerMode === 'NONE'
              ? 'border-emerald-500 bg-emerald-50/80 text-emerald-950 font-bold shadow-xs'
              : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
              payerMode === 'NONE' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'
            }`}
          >
            {payerMode === 'NONE' && <Check className="w-2.5 h-2.5" />}
          </div>
          <div>
            <div className="font-bold flex items-center gap-1.5">
              <span>🌱 Volunteer (Food-Only)</span>
              <span className="text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.2 rounded font-extrabold">₹0</span>
            </div>
            <div className="text-[11px] text-slate-500 font-normal mt-0.5">
              Free community delivery. Dedicated food rescue volunteers only.
            </div>
          </div>
        </button>

        {/* User Pays Option */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleModeChange(myPayerOption)}
          className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 ${
            payerMode === myPayerOption
              ? 'border-blue-500 bg-blue-50/80 text-blue-950 font-bold shadow-xs'
              : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
              payerMode === myPayerOption ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
            }`}
          >
            {payerMode === myPayerOption && <Check className="w-2.5 h-2.5" />}
          </div>
          <div>
            <div className="font-bold">{myPayerLabel}</div>
            <div className="text-[11px] text-slate-500 font-normal mt-0.5">
              You will settle delivery stipend directly with the driver.
            </div>
          </div>
        </button>

        {/* 50/50 Split */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleModeChange('SPLIT')}
          className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 ${
            payerMode === 'SPLIT'
              ? 'border-purple-500 bg-purple-50/80 text-purple-950 font-bold shadow-xs'
              : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
              payerMode === 'SPLIT' ? 'border-purple-600 bg-purple-600 text-white' : 'border-slate-300'
            }`}
          >
            {payerMode === 'SPLIT' && <Check className="w-2.5 h-2.5" />}
          </div>
          <div>
            <div className="font-bold">Split 50 / 50</div>
            <div className="text-[11px] text-slate-500 font-normal mt-0.5">
              Donor & Recipient each contribute half of the delivery fee.
            </div>
          </div>
        </button>

        {/* Other Party Pays Option */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleModeChange(otherPayerOption)}
          className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 ${
            payerMode === otherPayerOption
              ? 'border-indigo-500 bg-indigo-50/80 text-indigo-950 font-bold shadow-xs'
              : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
              payerMode === otherPayerOption ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
            }`}
          >
            {payerMode === otherPayerOption && <Check className="w-2.5 h-2.5" />}
          </div>
          <div>
            <div className="font-bold">{otherPayerLabel}</div>
            <div className="text-[11px] text-slate-500 font-normal mt-0.5">
              Propose that the other partner coordinates driver stipend.
            </div>
          </div>
        </button>
      </div>

      {/* Amount input & Split visualization when paid */}
      {payerMode !== 'NONE' && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <label className="text-xs font-bold text-slate-800">
                Agreed Delivery Stipend Amount (₹)
              </label>
              <div className="text-[11px] text-slate-500">
                Platform capped at ₹500 maximum. Suggested: ₹{suggestedFee?.suggestedAmount || 95}.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-400 text-sm">₹</span>
              <input
                type="number"
                min="0"
                max="500"
                step="5"
                disabled={disabled}
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="w-24 px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:outline-emerald-500"
              />
            </div>
          </div>

          {payerMode === 'SPLIT' && (
            <div className="bg-purple-50/70 border border-purple-200 rounded-lg p-2.5 text-xs text-purple-900 flex items-center justify-between">
              <span>Donor Share: <strong>₹{Math.round(amount / 2)}</strong></span>
              <span className="text-purple-400 font-bold">•</span>
              <span>Recipient Share: <strong>₹{Math.round(amount / 2)}</strong></span>
            </div>
          )}
        </div>
      )}

      {/* Legal & External Settlement Disclaimer */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 flex items-start gap-2 text-[11px] text-amber-900">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <strong>Non-commercial direct settlement:</strong> Share A Plate does not collect, process, or escrow delivery fee payments. Delivery fees or stipends are settled directly between parties and drivers outside the platform upon physical handover.
        </div>
      </div>
    </div>
  );
};
