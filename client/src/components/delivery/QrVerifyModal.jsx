import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useDonations } from '../../context/DonationContext';
import {
  QrCode,
  ShieldCheck,
  CheckCircle2,
  Scan,
  AlertTriangle,
  Lock,
} from 'lucide-react';

export const QrVerifyModal = ({ isOpen, onClose, task }) => {
  const { verifyHandover } = useDonations();
  const [tokenInput, setTokenInput] = useState('');
  const [checklist, setChecklist] = useState({
    sealIntact: true,
    temperatureChecked: true,
    noSpillage: true,
    labelPresent: true,
  });
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!task) return null;

  const allSafetyPassed =
    checklist.sealIntact &&
    checklist.temperatureChecked &&
    checklist.noSpillage &&
    checklist.labelPresent;

  const handleSimulateScan = () => {
    // Fill in the actual required token from the task
    setTokenInput(task.qrRequiredToken);
    setErrorMsg('');
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setErrorMsg('Please scan or enter the handover verification QR token.');
      return;
    }
    if (!allSafetyPassed) {
      setErrorMsg('All 4 food safety checkpoints must be verified before completing handover.');
      return;
    }

    try {
      setVerifying(true);
      setErrorMsg('');
      await verifyHandover({
        taskId: task.id,
        qrToken: tokenInput.trim(),
        safetyChecklist: checklist,
      });
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'QR Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="QR Handover & Safety Verification" maxWidth="max-w-xl">
      <form onSubmit={handleVerify} className="space-y-4">
        {/* Task Info Pill */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-slate-800">{task.foodName}</span>
            <div className="text-slate-500">{task.quantity} • {task.dropoff?.recipientName}</div>
          </div>
          <span className="bg-indigo-50 text-indigo-700 font-mono font-bold px-2 py-1 rounded border border-indigo-200">
            {task.id}
          </span>
        </div>

        {/* QR Scan Area */}
        <div className="border-2 border-dashed border-slate-300 rounded-2xl p-4 bg-slate-50/50 text-center space-y-3">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm border border-slate-200 text-rose-600">
            <Scan className="w-6 h-6 animate-pulse" />
          </div>

          <div>
            <h5 className="text-sm font-bold text-slate-800">Scan Handover QR Code</h5>
            <p className="text-xs text-slate-500 mt-0.5">
              Scan recipient's terminal screen or enter the single-use token
            </p>
          </div>

          <div className="flex gap-2 max-w-sm mx-auto">
            <input
              type="text"
              placeholder="Paste or type QR token..."
              value={tokenInput}
              onChange={(e) => {
                setTokenInput(e.target.value);
                setErrorMsg('');
              }}
              className="flex-1 px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-rose-500"
            />
            <button
              type="button"
              onClick={handleSimulateScan}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold shrink-0 transition"
            >
              Simulate Scan
            </button>
          </div>
        </div>

        {/* Mandatory 4-Point Safety Checklist */}
        <div className="border border-emerald-200 bg-emerald-50/40 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 uppercase">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Mandatory Physical Handover Safety Verification
          </div>

          <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={checklist.sealIntact}
              onChange={(e) => setChecklist({ ...checklist, sealIntact: e.target.checked })}
              className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
            />
            <span>1. Packaging seal intact (No tampering during transit)</span>
          </label>

          <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={checklist.temperatureChecked}
              onChange={(e) => setChecklist({ ...checklist, temperatureChecked: e.target.checked })}
              className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
            />
            <span>2. Temperature verified (Thermal box / hot chain preserved)</span>
          </label>

          <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={checklist.noSpillage}
              onChange={(e) => setChecklist({ ...checklist, noSpillage: e.target.checked })}
              className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
            />
            <span>3. Clean condition (No spillage or container leaks)</span>
          </label>

          <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={checklist.labelPresent}
              onChange={(e) => setChecklist({ ...checklist, labelPresent: e.target.checked })}
              className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
            />
            <span>4. Dietary & prep time label confirmed with recipient</span>
          </label>
        </div>

        {errorMsg && (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={verifying || !tokenInput.trim() || !allSafetyPassed}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{verifying ? 'Verifying with Server...' : 'Confirm Handover & Complete'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
