import React from 'react';

/**
 * Radius selector component for switching radar radius presets (5 km, 7 km, 10 km).
 * Respects hard max of 10 km to safeguard location privacy.
 */
const RadiusSelector = ({ radiusKm = 5, onChange, disabled = false, presets = [5, 7, 10] }) => {
  return (
    <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-700/60 shadow-inner">
      <span className="text-xs font-medium text-slate-400 px-2 select-none">
        Radar:
      </span>
      {presets.map((preset) => {
        const isSelected = Number(radiusKm) === preset;
        return (
          <button
            key={preset}
            type="button"
            disabled={disabled}
            onClick={() => onChange(preset)}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all duration-150 ${
              isSelected
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {preset} km
          </button>
        );
      })}
    </div>
  );
};

export default RadiusSelector;
