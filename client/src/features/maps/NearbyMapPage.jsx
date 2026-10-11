import React, { useState, useEffect, useCallback, useMemo } from 'react';
import MapView from './MapView';
import RadiusSelector from './RadiusSelector';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Map as MapIcon,
  List,
  Radar,
  RefreshCw,
  SlidersHorizontal,
  AlertCircle,
  Building2,
  Package,
  Layers,
  ChevronRight,
} from 'lucide-react';
import PriorityBadge from '../../components/common/PriorityBadge';

const NearbyMapPage = () => {
  const { user } = useAuth();

  const [radiusKm, setRadiusKm] = useState(5);
  const [activeKind, setActiveKind] = useState('all');
  const [viewMode, setViewMode] = useState('map'); // 'map' | 'list'
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [expandedRadius, setExpandedRadius] = useState(false);
  const [error, setError] = useState(null);

  // Search center: user's location if available, otherwise Bengaluru center
  const center = useMemo(() => {
    if (user?.location?.coordinates && Array.isArray(user.location.coordinates)) {
      return [user.location.coordinates[1], user.location.coordinates[0]];
    }
    return [12.9716, 77.5946];
  }, [user]);

  // Load nearby items from API
  const loadNearby = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.fetchNearbyMap({
        lat: center[0],
        lng: center[1],
        radiusKm,
        kind: activeKind === 'all' ? undefined : activeKind,
      });

      const data = response?.data || response?.items || response || [];
      setItems(Array.isArray(data) ? data : []);
      setExpandedRadius(Boolean(response?.expandedRadius));
    } catch (err) {
      setError(
        err.message || 'Unable to fetch nearby radar items. Check your internet connection.'
      );
    } finally {
      setLoading(false);
    }
  }, [center, radiusKm, activeKind]);

  useEffect(() => {
    loadNearby();
  }, [loadNearby]);

  // Counts by kind
  const countsByKind = useMemo(() => {
    const counts = { donations: 0, requirements: 0, donors: 0, recipients: 0 };
    items.forEach((item) => {
      if (item.kind === 'donation' || item.foodName) counts.donations++;
      else if (item.kind === 'requirement' || item.servingsNeeded) counts.requirements++;
      else if (item.kind === 'donor' || item.role === 'donor') counts.donors++;
      else if (item.kind === 'recipient' || item.role === 'recipient') counts.recipients++;
    });
    return counts;
  }, [items]);

  // Filtered items based on kind
  const filteredItems = useMemo(() => {
    if (activeKind === 'all') return items;
    return items.filter((item) => {
      if (activeKind === 'donations') return item.kind === 'donation' || Boolean(item.foodName);
      if (activeKind === 'requirements') return item.kind === 'requirement' || Boolean(item.servingsNeeded);
      if (activeKind === 'donors') return item.kind === 'donor' || item.role === 'donor';
      if (activeKind === 'recipients') return item.kind === 'recipient' || item.role === 'recipient';
      return true;
    });
  }, [items, activeKind]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/70 p-5 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 text-amber-500 font-bold text-sm tracking-wide uppercase">
            <Radar className="w-4 h-4 animate-spin-slow" />
            <span>5–10 km Proximity Radar</span>
          </div>
          <h1 className="text-2xl font-black text-white mt-1">Nearby Community Map</h1>
          <p className="text-xs text-slate-400 mt-1">
            Privacy-safe neighborhood radar with real-time food donations, requirements & registered centers.
          </p>
        </div>

        {/* Controls: Radius, List/Map toggle, Refresh */}
        <div className="flex flex-wrap items-center gap-3">
          <RadiusSelector
            radiusKm={radiusKm}
            onChange={(r) => setRadiusKm(r)}
            disabled={loading}
          />

          <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                viewMode === 'map' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <MapIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Map</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                viewMode === 'list' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>

          <button
            type="button"
            onClick={loadNearby}
            disabled={loading}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
            title="Refresh Radar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Expanded radius notification */}
      {expandedRadius && (
        <div className="bg-amber-950/40 border border-amber-700/60 p-3.5 rounded-xl flex items-center gap-3 text-xs text-amber-300">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            No items were found within 5 km, so the radar was automatically expanded to <strong>10 km</strong> to find available meals and verified community centers.
          </span>
        </div>
      )}

      {/* Error notification */}
      {error && (
        <div className="bg-rose-950/40 border border-rose-800/60 p-3.5 rounded-xl flex items-center gap-3 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main View: Map or List */}
      {viewMode === 'map' ? (
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 shadow-2xl">
          <MapView
            center={center}
            radiusKm={radiusKm}
            items={filteredItems}
            activeKind={activeKind}
            onKindChange={setActiveKind}
            countsByKind={countsByKind}
            userLocation={center}
            className="h-[600px] w-full rounded-xl overflow-hidden"
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-400 flex items-center justify-between px-1">
            <span>Showing {filteredItems.length} nearby locations</span>
            <span className="text-amber-500 font-bold">{radiusKm} km radius</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item, idx) => (
              <div
                key={item._id || item.id || idx}
                className="bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 p-4 rounded-xl transition shadow-lg flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      {item.kind || (item.foodName ? 'Donation' : 'Requirement')}
                    </span>
                    {item.priority && (
                      <PriorityBadge priority={item.priority} size="sm" showIcon={false} />
                    )}
                  </div>

                  <h3 className="font-bold text-slate-100 text-sm">
                    {item.foodName || item.title || item.name || item.organization?.name}
                  </h3>

                  <p className="text-xs text-slate-400 mt-1">
                    {item.areaLabel || item.address?.city || 'Local Area'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="font-semibold text-amber-400">
                    {item.distanceKm !== undefined ? `~${item.distanceKm} km away` : 'Nearby'}
                  </span>
                  <span className="text-slate-500">
                    {item.quantity || item.remainingQuantity
                      ? `${item.remainingQuantity || item.quantity} portions`
                      : 'Verified'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NearbyMapPage;
