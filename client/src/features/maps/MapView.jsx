import React, { useEffect, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Polyline,
  useMap,
} from 'react-leaflet';
import { MAP_CONFIG, createPinIcon, ROLE_COLORS, PRIORITY_COLORS } from './leafletConfig';
import PriorityBadge from '../../components/common/PriorityBadge';
import { Clock, Navigation, MapPin, Package, AlertCircle } from 'lucide-react';

/**
 * Helper hook to automatically pan and zoom map when center or bounds change.
 */
const MapAutoFitter = ({ center, markers = [], routeCoords = null }) => {
  const map = useMap();

  useEffect(() => {
    if (routeCoords && routeCoords.length > 1) {
      try {
        map.fitBounds(routeCoords, { padding: [40, 40], maxZoom: 15 });
      } catch {
        map.setView(center, map.getZoom());
      }
    } else if (center && Array.isArray(center) && center.length === 2) {
      map.setView(center, map.getZoom());
    }
  }, [center, routeCoords, map]);

  return null;
};

const MapView = ({
  center = MAP_CONFIG.defaultCenter,
  radiusKm = 5,
  items = [],
  activeKind = 'all',
  onKindChange,
  countsByKind = {},
  userLocation = null,
  routeCoords = null,
  routeEtaMinutes = null,
  onItemAction = null,
  className = 'h-[500px] w-full rounded-2xl overflow-hidden shadow-2xl border border-slate-700/60',
}) => {
  // Center coordinates validation
  const validCenter = useMemo(() => {
    if (Array.isArray(center) && center.length === 2 && !isNaN(center[0]) && !isNaN(center[1])) {
      return center;
    }
    return MAP_CONFIG.defaultCenter;
  }, [center]);

  return (
    <div className="relative flex flex-col w-full h-full">
      {/* Top filter bar & counters */}
      {onKindChange && (
        <div className="flex flex-wrap items-center gap-2 mb-3 px-1">
          {[
            { id: 'all', label: 'All Markers', count: items.length },
            { id: 'donations', label: 'Donations', count: countsByKind.donations || 0 },
            { id: 'requirements', label: 'Requirements', count: countsByKind.requirements || 0 },
            { id: 'donors', label: 'Donors', count: countsByKind.donors || 0 },
            { id: 'recipients', label: 'Recipients', count: countsByKind.recipients || 0 },
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => onKindChange(chip.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                activeKind === chip.id
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-bold'
                  : 'bg-slate-900/80 text-slate-300 border-slate-700/60 hover:bg-slate-800'
              }`}
            >
              {chip.label}
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-slate-950/40">
                {chip.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Map Container */}
      <div className={`relative ${className}`}>
        <MapContainer
          center={validCenter}
          zoom={MAP_CONFIG.defaultZoom}
          scrollWheelZoom={true}
          className="h-full w-full z-0"
        >
          <TileLayer
            attribution={MAP_CONFIG.attribution}
            url={MAP_CONFIG.tileUrl}
            maxZoom={19}
          />

          <MapAutoFitter center={validCenter} markers={items} routeCoords={routeCoords} />

          {/* Privacy Search Radar Radius Circle */}
          {radiusKm && (
            <Circle
              center={validCenter}
              radius={radiusKm * 1000}
              pathOptions={{
                color: '#f59e0b',
                fillColor: '#fbbf24',
                fillOpacity: 0.08,
                weight: 1.5,
                dashArray: '4, 6',
              }}
            />
          )}

          {/* User / Search Origin Marker */}
          {userLocation && (
            <Marker
              position={userLocation}
              icon={createPinIcon(ROLE_COLORS.user_center, '★')}
            >
              <Popup>
                <div className="p-1 text-slate-900 font-sans">
                  <div className="font-bold text-sm text-rose-600 flex items-center gap-1">
                    <Navigation className="w-3.5 h-3.5" /> Your Radar Center
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    Searching within <strong>{radiusKm} km</strong> privacy zone
                  </div>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Connected Party Route Line */}
          {routeCoords && routeCoords.length > 1 && (
            <Polyline
              positions={routeCoords}
              pathOptions={{
                color: '#2563eb',
                weight: 4,
                opacity: 0.85,
                dashArray: '8, 8',
              }}
            />
          )}

          {/* Items Markers */}
          {items.map((item, idx) => {
            // Read latitude and longitude (GeoJSON coordinates are [lng, lat])
            const coords = item.approxLocation?.coordinates || item.location?.coordinates;
            if (!coords || !Array.isArray(coords) || coords.length < 2) return null;
            const lat = coords[1];
            const lng = coords[0];
            if (isNaN(lat) || isNaN(lng)) return null;

            // Pin styling based on kind and priority
            const isDonation = item.kind === 'donation' || item.foodName;
            const isRequirement = item.kind === 'requirement' || item.servingsNeeded;
            const isDonor = item.kind === 'donor' || item.role === 'donor';
            const isRecipient = item.kind === 'recipient' || item.role === 'recipient';

            let pinColor = ROLE_COLORS.donor;
            let pinLabel = 'D';

            if (isRequirement || isRecipient) {
              pinColor = ROLE_COLORS.recipient;
              pinLabel = 'R';
            }
            if (item.priority) {
              pinColor = PRIORITY_COLORS[item.priority] || pinColor;
            }

            return (
              <Marker
                key={item._id || item.id || `marker-${idx}`}
                position={[lat, lng]}
                icon={createPinIcon(pinColor, pinLabel)}
              >
                <Popup className="custom-popup">
                  <div className="p-1 font-sans text-slate-900 min-w-[210px] max-w-[280px]">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        {item.kind || (isDonation ? 'Donation' : isRequirement ? 'Requirement' : 'Partner')}
                      </span>
                      {item.priority && (
                        <PriorityBadge priority={item.priority} size="sm" showIcon={false} />
                      )}
                    </div>

                    <h4 className="font-bold text-sm text-slate-900 leading-snug">
                      {item.foodName || item.title || item.name || item.organization?.name || 'Share A Plate Item'}
                    </h4>

                    {/* Area label & distance */}
                    <div className="flex items-center gap-1 text-xs text-slate-600 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{item.areaLabel || item.address?.city || 'Local Area'}</span>
                      {item.distanceKm !== undefined && (
                        <span className="ml-auto font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                          {item.distanceKm} km
                        </span>
                      )}
                    </div>

                    {/* Quantity & Food details */}
                    {(item.quantity || item.remainingQuantity || item.servingsNeeded) && (
                      <div className="flex items-center gap-1 text-xs text-slate-700 mt-1">
                        <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          {item.remainingQuantity !== undefined
                            ? `${item.remainingQuantity} ${item.unit || 'portions'} left`
                            : item.quantity
                            ? `${item.quantity} ${item.unit || 'portions'}`
                            : `${item.servingsNeeded} servings needed`}
                        </span>
                      </div>
                    )}

                    {/* Expiry or countdown */}
                    {item.secondsToEffectiveExpiry !== undefined && (
                      <div className="flex items-center gap-1 text-[11px] text-amber-700 font-medium mt-1">
                        <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                        <span>
                          Safe Expiry: {Math.max(1, Math.round(item.secondsToEffectiveExpiry / 60))} mins left
                        </span>
                      </div>
                    )}

                    {/* Action button if provided */}
                    {onItemAction && (
                      <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end">
                        <button
                          type="button"
                          onClick={() => onItemAction(item)}
                          className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg shadow-sm transition"
                        >
                          View Details
                        </button>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Route ETA pill if active */}
        {routeEtaMinutes && (
          <div className="absolute top-3 right-3 z-[1000] bg-slate-900/90 text-white backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 shadow-xl flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-medium text-slate-300">Live Road ETA:</span>
            <span className="font-bold text-amber-400">~{routeEtaMinutes} mins</span>
          </div>
        )}

        {/* Map Legend */}
        <div className="absolute bottom-3 left-3 z-[1000] bg-slate-900/90 text-white backdrop-blur-md px-3 py-2 rounded-xl border border-slate-800 shadow-lg text-[11px] hidden sm:flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Donor / LOW</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>MEDIUM</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>HIGH</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>Recipient</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapView;
