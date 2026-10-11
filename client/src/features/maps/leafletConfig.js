import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet icon paths in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export const MAP_CONFIG = {
  tileUrl: import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
  defaultCenter: [
    parseFloat(import.meta.env.VITE_DEFAULT_LAT || 12.9716),
    parseFloat(import.meta.env.VITE_DEFAULT_LNG || 77.5946),
  ],
  defaultZoom: 13,
};

// Create SVG colored pins for roles and priority levels
export const createPinIcon = (color = '#f59e0b', label = '') => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="32" height="42">
      <defs>
        <filter id="shadow" x="-20%" y="-10%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.3"/>
        </filter>
      </defs>
      <path fill="${color}" filter="url(#shadow)" stroke="#ffffff" stroke-width="2" d="M16 0C7.163 0 0 7.163 0 16c0 10.5 16 26 16 26s16-15.5 16-26c0-8.837-7.163-16-16-16z"/>
      <circle cx="16" cy="15" r="7" fill="#ffffff" />
      <text x="16" y="19" font-size="10" font-weight="bold" font-family="sans-serif" text-anchor="middle" fill="${color}">${label}</text>
    </svg>
  `;
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: svg,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -38],
  });
};

export const ROLE_COLORS = {
  donor: '#10b981',       // Emerald Green
  recipient: '#3b82f6',   // Blue
  delivery_agent: '#8b5cf6', // Purple
  user_center: '#e11d48', // Rose / Red pulse
};

export const PRIORITY_COLORS = {
  LOW: '#10b981',     // Green
  MEDIUM: '#f59e0b',  // Amber
  HIGH: '#ef4444',    // Red
};
