import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { MAP_CONFIG, createPinIcon, ROLE_COLORS } from './leafletConfig';
import { Search, MapPin, Navigation, Loader2 } from 'lucide-react';
import api from '../../services/api';

/**
 * Helper hook to capture map clicks and marker dragging.
 */
const DraggableLocationMarker = ({ position, onPositionChange }) => {
  const markerRef = useRef(null);

  useMapEvents({
    click(e) {
      if (e.latlng) {
        onPositionChange([e.latlng.lat, e.latlng.lng]);
      }
    },
  });

  const eventHandlers = React.useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const latlng = marker.getLatLng();
          onPositionChange([latlng.lat, latlng.lng]);
        }
      },
    }),
    [onPositionChange]
  );

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
      icon={createPinIcon(ROLE_COLORS.user_center, '📍')}
    />
  );
};

const LocationPicker = ({
  initialLocation = null, // [lng, lat] GeoJSON or [lat, lng]
  initialAddress = '',
  onChange, // ({ location: { type: 'Point', coordinates: [lng, lat] }, address: string, details: Object }) => void
  disabled = false,
  className = '',
}) => {
  // Normalize starting position to [lat, lng] for Leaflet
  const getInitialLatLng = () => {
    if (Array.isArray(initialLocation) && initialLocation.length === 2) {
      // If coordinates match GeoJSON [lng, lat] with India range (lng ~68-98, lat ~8-37)
      if (initialLocation[0] > 60 && initialLocation[1] < 40) {
        return [initialLocation[1], initialLocation[0]];
      }
      return initialLocation;
    }
    return MAP_CONFIG.defaultCenter;
  };

  const [position, setPosition] = useState(getInitialLatLng);
  const [searchQuery, setSearchQuery] = useState(initialAddress || '');
  const [isSearching, setIsSearching] = useState(false);
  const [isGeolocating, setIsGeolocating] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [statusMessage, setStatusMessage] = useState(null);

  const debounceTimer = useRef(null);

  // Reverse geocode when position moves
  const handlePositionMoved = useCallback(
    async ([lat, lng]) => {
      setPosition([lat, lng]);
      try {
        const geoData = await api.reverseGeocode(lat, lng);
        const resolvedAddress = geoData?.address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        setSearchQuery(resolvedAddress);

        if (onChange) {
          onChange({
            location: {
              type: 'Point',
              coordinates: [Number(lng.toFixed(6)), Number(lat.toFixed(6))], // GeoJSON order [lng, lat]
            },
            address: resolvedAddress,
            details: geoData,
          });
        }
      } catch (err) {
        // Fallback without network
        if (onChange) {
          onChange({
            location: {
              type: 'Point',
              coordinates: [Number(lng.toFixed(6)), Number(lat.toFixed(6))],
            },
            address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
            details: null,
          });
        }
      }
    },
    [onChange]
  );

  // Search forward address (Nominatim / /api/v1/geo/search)
  const executeSearch = useCallback(
    async (query) => {
      const q = query.trim();
      if (q.length < 3) return;
      setIsSearching(true);
      setStatusMessage(null);

      try {
        const results = await api.searchAddress(q);
        if (Array.isArray(results) && results.length > 0) {
          setSearchResults(results);
        } else {
          setSearchResults([]);
          setStatusMessage('No locations found in India. Try a different landmark or area.');
        }
      } catch (err) {
        setStatusMessage('Location service busy or offline. Click on the map directly to position.');
      } finally {
        setIsSearching(false);
      }
    },
    []
  );

  // Trigger search on typing with strict 800ms debounce
  const handleQueryChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (val.trim().length >= 3) {
      debounceTimer.current = setTimeout(() => {
        executeSearch(val);
      }, 800);
    } else {
      setSearchResults([]);
    }
  };

  // Immediate search on Enter key press
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      executeSearch(searchQuery);
    }
  };

  // Select search result
  const handleSelectResult = (result) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lng);
    setSearchResults([]);
    handlePositionMoved([lat, lng]);
  };

  // Use browser Geolocation with graceful permission denial fallback
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setStatusMessage('Geolocation is not supported by your browser.');
      return;
    }
    setIsGeolocating(true);
    setStatusMessage(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsGeolocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        handlePositionMoved([lat, lng]);
      },
      (err) => {
        setIsGeolocating(false);
        setStatusMessage(
          'Location access was denied or unavailable. You can search or drag the map pin instead.'
        );
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Search Input and Geolocation trigger */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              disabled={disabled}
              value={searchQuery}
              onChange={handleQueryChange}
              onKeyDown={handleKeyDown}
              placeholder="Search area, landmark or street (e.g. Indiranagar, Bengaluru)..."
              className="w-full pl-10 pr-10 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
            {isSearching && (
              <Loader2 className="w-4 h-4 absolute right-3.5 top-3.5 text-amber-500 animate-spin" />
            )}
          </div>

          <button
            type="button"
            disabled={disabled || isGeolocating}
            onClick={handleUseCurrentLocation}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            title="Use My Current GPS Location"
          >
            {isGeolocating ? (
              <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
            ) : (
              <Navigation className="w-4 h-4 text-amber-400" />
            )}
            <span className="hidden sm:inline">My Location</span>
          </button>
        </div>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 z-[1200] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
            {searchResults.map((res, i) => (
              <button
                key={res.place_id || i}
                type="button"
                onClick={() => handleSelectResult(res)}
                className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-slate-800 border-b border-slate-800/80 last:border-b-0 flex items-start gap-2.5 transition"
              >
                <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span className="line-clamp-2">{res.display_name || res.formattedAddress}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {statusMessage && (
        <div className="text-xs text-amber-400/90 bg-amber-950/30 border border-amber-800/50 px-3 py-1.5 rounded-lg">
          {statusMessage}
        </div>
      )}

      {/* Map display with Draggable Pin */}
      <div className="h-56 w-full rounded-xl overflow-hidden border border-slate-700 relative shadow-inner">
        <MapContainer
          center={position}
          zoom={14}
          scrollWheelZoom={false}
          className="h-full w-full z-0"
        >
          <TileLayer
            attribution={MAP_CONFIG.attribution}
            url={MAP_CONFIG.tileUrl}
            maxZoom={19}
          />
          <DraggableLocationMarker
            position={position}
            onPositionChange={handlePositionMoved}
          />
        </MapContainer>
        <div className="absolute bottom-2 right-2 z-[1000] bg-slate-950/80 text-[10px] text-slate-400 px-2 py-0.5 rounded backdrop-blur-sm pointer-events-none">
          Click map or drag pin to fine-tune
        </div>
      </div>
    </div>
  );
};

export default LocationPicker;
