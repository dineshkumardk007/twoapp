import React, { useState, useRef, useEffect } from 'react';
import { MemoryCoordinatePin, CoordinateCategory } from '../types';
import {
  MapPin,
  Compass,
  Plus,
  Heart,
  Music,
  CloudRain,
  Navigation,
  Search,
  Filter,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Trash2,
  Calendar,
  Crosshair
} from 'lucide-react';
import { newId } from '../core/ids';

interface CoordinatesMapViewProps {
  pins: MemoryCoordinatePin[];
  activeUser: 'user' | 'partner';
  onAddPin: (pin: MemoryCoordinatePin) => void;
  onDeletePin: (pinId: string) => void;
  onToggleFavorite: (pinId: string) => void;
  onSendToChat?: (text: string) => void;
}

// Audio chime for pins
function playPinPing(frequency = 660) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, now);
    osc.frequency.exponentialRampToValueAtTime(frequency * 1.5, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(frequency, now + 0.4);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 1.3);
  } catch (e) {
    // ignore
  }
}

// Equirectangular projection helpers
const MAP_WIDTH = 1000;
const MAP_HEIGHT = 500;

function latLonToXY(lat: number, lon: number): { x: number; y: number } {
  // Clamp latitude to -85 to 85
  const clampedLat = Math.max(-85, Math.min(85, lat));
  // Clamp longitude to -180 to 180
  const clampedLon = Math.max(-180, Math.min(180, lon));

  const x = ((clampedLon + 180) / 360) * MAP_WIDTH;
  const y = ((90 - clampedLat) / 180) * MAP_HEIGHT;
  return { x, y };
}

function xyToLatLon(x: number, y: number): { lat: number; lon: number } {
  const lon = (x / MAP_WIDTH) * 360 - 180;
  const lat = 90 - (y / MAP_HEIGHT) * 180;
  return {
    lat: Math.round(lat * 10000) / 10000,
    lon: Math.round(lon * 10000) / 10000
  };
}

const CATEGORY_META: Record<
  CoordinateCategory,
  { label: string; colorClass: string; pinBg: string; pinBorder: string; icon: string }
> = {
  first_date: {
    label: 'First Date',
    colorClass: 'text-amber-700 bg-amber-50 border-amber-200',
    pinBg: '#f59e0b',
    pinBorder: '#b45309',
    icon: '☕'
  },
  first_kiss: {
    label: 'First Kiss',
    colorClass: 'text-rose-700 bg-rose-50 border-rose-200',
    pinBg: '#f43f5e',
    pinBorder: '#be123c',
    icon: '💋'
  },
  favorite_cafe: {
    label: 'Favorite Café',
    colorClass: 'text-amber-800 bg-amber-100/60 border-amber-300',
    pinBg: '#d97706',
    pinBorder: '#78350f',
    icon: '🥐'
  },
  adventure: {
    label: 'Epic Adventure',
    colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    pinBg: '#10b981',
    pinBorder: '#047857',
    icon: '🎒'
  },
  secret_spot: {
    label: 'Secret Hideaway',
    colorClass: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    pinBg: '#6366f1',
    pinBorder: '#4338ca',
    icon: '🤫'
  },
  dream_destination: {
    label: 'Dream Destination',
    colorClass: 'text-sky-700 bg-sky-50 border-sky-200',
    pinBg: '#0ea5e9',
    pinBorder: '#0369a1',
    icon: '✈️'
  }
};

export const CoordinatesMapView: React.FC<CoordinatesMapViewProps> = ({
  pins,
  activeUser,
  onAddPin,
  onDeletePin,
  onToggleFavorite,
  onSendToChat
}) => {
  const [selectedPin, setSelectedPin] = useState<MemoryCoordinatePin | null>(pins[0] || null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // New Pin form states
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<CoordinateCategory>('secret_spot');
  const [newLocationName, setNewLocationName] = useState('');
  const [newStory, setNewStory] = useState('');
  const [newDate, setNewDate] = useState('Today');
  const [newLat, setNewLat] = useState<number>(40.7128);
  const [newLon, setNewLon] = useState<number>(-74.006);
  const [newSong, setNewSong] = useState('');
  const [newWeather, setNewWeather] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Filtered pins
  const filteredPins = pins.filter(pin => {
    const matchesCategory = filterCategory === 'all' || pin.category === filterCategory;
    const matchesSearch =
      pin.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pin.locationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pin.story.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handlePinClick = (pin: MemoryCoordinatePin) => {
    playPinPing(700);
    setSelectedPin(pin);
    // Smoothly center the map on clicked pin
    const { x, y } = latLonToXY(pin.latitude, pin.longitude);
    setPanOffset({
      x: (MAP_WIDTH / 2 - x) * (zoomLevel - 1) * 0.2,
      y: (MAP_HEIGHT / 2 - y) * (zoomLevel - 1) * 0.2
    });
  };

  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * MAP_WIDTH;
    const clickY = ((e.clientY - rect.top) / rect.height) * MAP_HEIGHT;
    const { lat, lon } = xyToLatLon(clickX, clickY);

    if (showAddModal) {
      setNewLat(lat);
      setNewLon(lon);
      playPinPing(540);
    }
  };

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPanOffset({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Browser Geolocation auto-detect
  const handleGetCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setNewLat(Math.round(pos.coords.latitude * 10000) / 10000);
        setNewLon(Math.round(pos.coords.longitude * 10000) / 10000);
        setIsLocating(false);
        playPinPing(880);
      },
      err => {
        setIsLocating(false);
        alert('Could not retrieve current coordinates. You can click on the map or type them.');
      },
      { timeout: 10000 }
    );
  };

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newLocationName.trim()) return;

    const pin: MemoryCoordinatePin = {
      id: newId('pin'),
      title: newTitle.trim(),
      category: newCategory,
      locationName: newLocationName.trim(),
      story: newStory.trim() || 'A quiet moment held close in memory.',
      date: newDate.trim() || 'Recently',
      latitude: Number(newLat),
      longitude: Number(newLon),
      authorId: activeUser,
      authorName: activeUser === 'user' ? 'You' : 'Partner',
      songSnippet: newSong.trim() || undefined,
      weatherAtMoment: newWeather.trim() || undefined,
      isFavorite: false
    };

    onAddPin(pin);
    setSelectedPin(pin);
    setShowAddModal(false);
    playPinPing(800);

    // Reset fields
    setNewTitle('');
    setNewLocationName('');
    setNewStory('');
    setNewSong('');
    setNewWeather('');
  };

  return (
    <div className="space-y-6">
      {/* Header with Relational Geocache Philosophy */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Compass className="w-5 h-5 text-linen-accent" />
            <span className="text-xs font-semibold uppercase tracking-widest text-linen-accent">
              Memory Cartography
            </span>
          </div>
          <h2 className="font-serif text-2xl font-bold text-linen-primary mt-1">
            Our Secret Coordinates
          </h2>
          <p className="text-xs text-linen-secondary mt-0.5">
            Encrypted geocache pins of places where love, laughter, and history were born.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity shadow-sm cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Pin Sacred Coordinate</span>
        </button>
      </div>

      {/* Interactive Map Canvas Container */}
      <div className="rounded-3xl border border-linen-border bg-gradient-to-b from-[#f8f6f0] to-[#f0ece1] shadow-md overflow-hidden relative select-none">
        {/* Map Toolbar overlay */}
        <div className="absolute top-3 left-3 z-20 flex items-center space-x-2">
          {/* Zoom controls */}
          <div className="flex items-center bg-linen-surface/90 backdrop-blur-md rounded-xl border border-linen-border p-1 shadow-xs">
            <button
              onClick={() => setZoomLevel(prev => Math.min(prev + 0.3, 2.5))}
              className="p-1.5 rounded-lg hover:bg-linen-variant text-linen-primary cursor-pointer transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoomLevel(prev => Math.max(prev - 0.3, 1))}
              className="p-1.5 rounded-lg hover:bg-linen-variant text-linen-primary cursor-pointer transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setZoomLevel(1);
                setPanOffset({ x: 0, y: 0 });
              }}
              className="p-1.5 rounded-lg hover:bg-linen-variant text-linen-primary cursor-pointer transition-colors"
              title="Reset map view"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <span className="hidden sm:inline-block px-2.5 py-1 rounded-xl bg-linen-surface/80 border border-linen-border text-[11px] font-serif text-linen-secondary backdrop-blur-xs">
            {filteredPins.length} coordinates charted
          </span>
        </div>

        {/* Vintage Compass Rose in Corner */}
        <div className="absolute bottom-3 right-3 z-20 pointer-events-none opacity-40 flex flex-col items-center">
          <div className="w-12 h-12 rounded-full border border-dashed border-linen-primary/40 flex items-center justify-center">
            <Compass className="w-8 h-8 text-linen-primary" />
          </div>
          <span className="text-[9px] font-serif uppercase tracking-widest text-linen-primary mt-0.5">True North</span>
        </div>

        {/* SVG World Canvas */}
        <div
          className="w-full h-[280px] sm:h-[380px] cursor-grab active:cursor-grabbing overflow-hidden"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            className="w-full h-full transition-transform duration-75"
            style={{
              transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`
            }}
            onClick={handleMapClick}
          >
            <defs>
              {/* Parchment Grid Pattern */}
              <pattern id="parchmentGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(163, 150, 133, 0.15)" strokeWidth="0.8" />
              </pattern>
              {/* Landmass Texture Gradient */}
              <radialGradient id="landGradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ebe4d3" />
                <stop offset="100%" stopColor="#dfd6c2" />
              </radialGradient>
            </defs>

            {/* Ocean background */}
            <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#f4efe4" />
            <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#parchmentGrid)" />

            {/* Latitude / Longitude lines */}
            <line x1="0" y1={MAP_HEIGHT / 2} x2={MAP_WIDTH} y2={MAP_HEIGHT / 2} stroke="#d4c9b8" strokeDasharray="4 4" strokeWidth="1" />
            <line x1={MAP_WIDTH / 2} y1="0" x2={MAP_WIDTH / 2} y2={MAP_HEIGHT} stroke="#d4c9b8" strokeDasharray="4 4" strokeWidth="1" />

            {/* Tropic and Meridian labels */}
            <text x="12" y={MAP_HEIGHT / 2 - 6} fill="#b0a28f" fontSize="9" fontFamily="serif">Equator (0°)</text>
            <text x={MAP_WIDTH / 2 + 6} y="18" fill="#b0a28f" fontSize="9" fontFamily="serif">Prime Meridian (0°)</text>

            {/* Stylized organic landmass paths */}
            {/* North America */}
            <path
              d="M 120 70 Q 200 60 250 90 T 260 170 Q 240 210 200 240 T 170 290 Q 140 260 110 210 T 80 140 Z"
              fill="url(#landGradient)"
              stroke="#cfc4b0"
              strokeWidth="1.2"
            />
            {/* South America */}
            <path
              d="M 230 260 Q 290 280 290 340 T 260 440 Q 240 470 220 460 T 200 360 Q 200 300 230 260 Z"
              fill="url(#landGradient)"
              stroke="#cfc4b0"
              strokeWidth="1.2"
            />
            {/* Europe */}
            <path
              d="M 450 80 Q 520 70 540 120 T 520 180 Q 470 200 440 180 T 430 130 Z"
              fill="url(#landGradient)"
              stroke="#cfc4b0"
              strokeWidth="1.2"
            />
            {/* Africa */}
            <path
              d="M 460 190 Q 550 200 560 280 T 520 400 Q 480 430 460 380 T 430 270 Q 430 210 460 190 Z"
              fill="url(#landGradient)"
              stroke="#cfc4b0"
              strokeWidth="1.2"
            />
            {/* Asia */}
            <path
              d="M 540 80 Q 750 60 840 120 T 850 240 Q 750 270 680 250 T 580 200 Q 530 140 540 80 Z"
              fill="url(#landGradient)"
              stroke="#cfc4b0"
              strokeWidth="1.2"
            />
            {/* Australia / Oceania */}
            <path
              d="M 760 320 Q 840 310 860 360 T 820 430 Q 770 440 750 390 Z"
              fill="url(#landGradient)"
              stroke="#cfc4b0"
              strokeWidth="1.2"
            />

            {/* Connecting Memory Constellation Arcs between pins */}
            {filteredPins.length > 1 &&
              filteredPins.slice(0, filteredPins.length - 1).map((pin, i) => {
                const nextPin = filteredPins[i + 1];
                const pt1 = latLonToXY(pin.latitude, pin.longitude);
                const pt2 = latLonToXY(nextPin.latitude, nextPin.longitude);
                const midX = (pt1.x + pt2.x) / 2;
                const midY = (pt1.y + pt2.y) / 2 - 30; // curve upwards
                return (
                  <path
                    key={`arc-${pin.id}-${nextPin.id}`}
                    d={`M ${pt1.x} ${pt1.y} Q ${midX} ${midY} ${pt2.x} ${pt2.y}`}
                    fill="none"
                    stroke="#e11d48"
                    strokeOpacity="0.25"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                );
              })}

            {/* Plotted Glowing Pins */}
            {filteredPins.map(pin => {
              const { x, y } = latLonToXY(pin.latitude, pin.longitude);
              const isSelected = selectedPin?.id === pin.id;
              const meta = CATEGORY_META[pin.category] || CATEGORY_META.secret_spot;

              return (
                <g
                  key={pin.id}
                  transform={`translate(${x}, ${y})`}
                  className="cursor-pointer group"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePinClick(pin);
                  }}
                >
                  {/* Outer pulse aura */}
                  <circle
                    r={isSelected ? 16 : 8}
                    fill={meta.pinBg}
                    fillOpacity={isSelected ? 0.35 : 0.15}
                    className={isSelected ? 'animate-ping duration-1000' : ''}
                  />

                  {/* Pin stem / marker */}
                  <circle
                    r={isSelected ? 9 : 6}
                    fill={meta.pinBg}
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="drop-shadow-md transition-all duration-300 group-hover:scale-125"
                  />

                  {/* Center Dot */}
                  <circle r={2.5} fill="#ffffff" />

                  {/* Pin Label tooltip */}
                  <text
                    x="10"
                    y="4"
                    fill="#433422"
                    fontSize={isSelected ? '12' : '10'}
                    fontWeight={isSelected ? '600' : '500'}
                    fontFamily="serif"
                    className="select-none pointer-events-none drop-shadow-xs"
                  >
                    {pin.title}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Filter & Category Ribbon */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 max-w-full">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1 rounded-full text-xs font-serif transition-colors cursor-pointer border ${
              filterCategory === 'all'
                ? 'bg-linen-primary text-linen-surface border-linen-primary'
                : 'bg-linen-surface text-linen-secondary border-linen-border hover:bg-linen-variant/50'
            }`}
          >
            All Coordinates ({pins.length})
          </button>
          {Object.entries(CATEGORY_META).map(([key, meta]) => {
            const count = pins.filter(p => p.category === key).length;
            if (count === 0 && filterCategory !== key) return null;
            return (
              <button
                key={key}
                onClick={() => setFilterCategory(key)}
                className={`px-3 py-1 rounded-full text-xs font-serif transition-colors cursor-pointer border flex items-center space-x-1 ${
                  filterCategory === key
                    ? 'bg-linen-primary text-linen-surface border-linen-primary'
                    : 'bg-linen-surface text-linen-secondary border-linen-border hover:bg-linen-variant/50'
                }`}
              >
                <span>{meta.icon}</span>
                <span>{meta.label}</span>
                <span className="text-[10px] opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-48">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-linen-secondary" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search memory or place..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-linen-surface border border-linen-border text-linen-primary placeholder-linen-secondary/60 focus:outline-none focus:border-linen-accent"
          />
        </div>
      </div>

      {/* Inspected Coordinate Detail Card */}
      {selectedPin ? (
        <div className="rounded-3xl border border-linen-border bg-linen-surface p-5 sm:p-6 shadow-xs relative animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className={`text-[11px] font-serif px-2.5 py-0.5 rounded-full border ${
                  CATEGORY_META[selectedPin.category]?.colorClass || 'bg-linen-variant text-linen-secondary border-linen-border'
                }`}>
                  {CATEGORY_META[selectedPin.category]?.icon} {CATEGORY_META[selectedPin.category]?.label}
                </span>

                <span className="text-xs text-linen-secondary font-mono">
                  {selectedPin.latitude > 0 ? `${selectedPin.latitude}°N` : `${Math.abs(selectedPin.latitude)}°S`},{' '}
                  {selectedPin.longitude > 0 ? `${selectedPin.longitude}°E` : `${Math.abs(selectedPin.longitude)}°W`}
                </span>
              </div>

              <h3 className="font-serif text-xl font-bold text-linen-primary">
                {selectedPin.title}
              </h3>

              <div className="flex items-center space-x-2 text-xs text-linen-accent font-medium">
                <MapPin className="w-3.5 h-3.5" />
                <span>{selectedPin.locationName}</span>
                <span>•</span>
                <span className="text-linen-secondary">{selectedPin.date}</span>
              </div>
            </div>

            {/* Top Action buttons */}
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={() => onToggleFavorite(selectedPin.id)}
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                  selectedPin.isFavorite
                    ? 'border-rose-300 bg-rose-50 text-rose-600'
                    : 'border-linen-border bg-linen-variant/40 text-linen-secondary hover:text-rose-500'
                }`}
                title="Favorite sacred memory"
              >
                <Heart className={`w-4 h-4 ${selectedPin.isFavorite ? 'fill-rose-500' : ''}`} />
              </button>

              <button
                onClick={() => onDeletePin(selectedPin.id)}
                className="p-2 rounded-xl border border-linen-border bg-linen-variant/40 text-linen-secondary hover:text-rose-600 transition-colors cursor-pointer"
                title="Remove coordinate"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Story & Emotional Resonance */}
          <div className="mt-4 p-4 rounded-2xl bg-linen-variant/40 border border-linen-border/60">
            <p className="font-serif text-sm text-linen-primary leading-relaxed">
              “{selectedPin.story}”
            </p>
          </div>

          {/* Sensory Memory Badges */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {selectedPin.weatherAtMoment && (
              <div className="flex items-center space-x-2 text-xs text-linen-secondary px-3 py-2 rounded-xl bg-linen-surface border border-linen-border">
                <CloudRain className="w-4 h-4 text-sky-600 shrink-0" />
                <span>Weather vibe: <strong className="text-linen-primary font-medium">{selectedPin.weatherAtMoment}</strong></span>
              </div>
            )}

            {selectedPin.songSnippet && (
              <div className="flex items-center space-x-2 text-xs text-linen-secondary px-3 py-2 rounded-xl bg-linen-surface border border-linen-border">
                <Music className="w-4 h-4 text-rose-500 shrink-0" />
                <span>Soundtrack: <strong className="text-linen-primary font-medium">{selectedPin.songSnippet}</strong></span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-linen-border flex items-center justify-between text-xs text-linen-secondary">
            <span>Pinned with tender care by {selectedPin.authorName}</span>
            {onSendToChat && (
              <button
                onClick={() => onSendToChat(`Remembering our secret coordinates: “${selectedPin.title}” at ${selectedPin.locationName}. ${selectedPin.story}`)}
                className="text-linen-accent font-medium hover:underline cursor-pointer flex items-center space-x-1"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                <span>Send to Chat</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="p-8 text-center rounded-3xl border border-dashed border-linen-border bg-linen-surface/50 text-linen-secondary font-serif text-sm">
          Select any glowing coordinate on the map to open its story.
        </div>
      )}

      {/* Pin a New Memory Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-linen-surface rounded-3xl border border-linen-border max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-linen-border pb-3">
              <div className="flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-linen-accent" />
                <h3 className="font-serif text-lg font-semibold text-linen-primary">
                  Pin a Sacred Coordinate
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-linen-secondary hover:text-linen-primary cursor-pointer text-sm font-serif"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePin} className="space-y-4 text-xs">
              <div>
                <label className="block text-linen-primary font-medium mb-1">
                  Memory Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. Our First Kiss Under the Streetlamp"
                  className="w-full px-3 py-2 rounded-xl bg-linen-bg border border-linen-border text-linen-primary focus:outline-none focus:border-linen-accent"
                />
              </div>

              <div>
                <label className="block text-linen-primary font-medium mb-1">
                  Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(CATEGORY_META).map(([catKey, meta]) => (
                    <button
                      type="button"
                      key={catKey}
                      onClick={() => setNewCategory(catKey as CoordinateCategory)}
                      className={`p-2 rounded-xl border text-left transition-colors cursor-pointer flex items-center space-x-1.5 ${
                        newCategory === catKey
                          ? 'border-linen-accent bg-linen-variant/60 font-medium'
                          : 'border-linen-border hover:bg-linen-variant/30'
                      }`}
                    >
                      <span>{meta.icon}</span>
                      <span className="truncate">{meta.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-linen-primary font-medium mb-1">
                  Location Name / Spot
                </label>
                <input
                  type="text"
                  required
                  value={newLocationName}
                  onChange={e => setNewLocationName(e.target.value)}
                  placeholder="e.g. Pier 7, San Francisco or Tokyo Tower observatory"
                  className="w-full px-3 py-2 rounded-xl bg-linen-bg border border-linen-border text-linen-primary focus:outline-none focus:border-linen-accent"
                />
              </div>

              {/* Coordinates input with GPS button */}
              <div className="p-3 rounded-2xl bg-linen-variant/40 border border-linen-border/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-serif font-medium text-linen-primary">Latitude & Longitude</span>
                  <button
                    type="button"
                    onClick={handleGetCurrentLocation}
                    disabled={isLocating}
                    className="inline-flex items-center space-x-1 text-linen-accent hover:underline cursor-pointer"
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    <span>{isLocating ? 'Locating...' : 'Use My Current GPS'}</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-linen-secondary">Latitude</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={newLat}
                      onChange={e => setNewLat(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-linen-surface border border-linen-border text-linen-primary font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-linen-secondary">Longitude</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={newLon}
                      onChange={e => setNewLon(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-linen-surface border border-linen-border text-linen-primary font-mono"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-linen-secondary italic">
                  Tip: You can also tap anywhere on the map above to drop this pin.
                </p>
              </div>

              <div>
                <label className="block text-linen-primary font-medium mb-1">
                  The Story / Sacred Memory
                </label>
                <textarea
                  rows={3}
                  value={newStory}
                  onChange={e => setNewStory(e.target.value)}
                  placeholder="What was said, felt, or whispered in that quiet corner of the earth?"
                  className="w-full px-3 py-2 rounded-xl bg-linen-bg border border-linen-border text-linen-primary focus:outline-none focus:border-linen-accent font-serif"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-linen-primary font-medium mb-1">Date</label>
                  <input
                    type="text"
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    placeholder="e.g. Oct 14, 2023"
                    className="w-full px-3 py-1.5 rounded-xl bg-linen-bg border border-linen-border text-linen-primary"
                  />
                </div>
                <div>
                  <label className="block text-linen-primary font-medium mb-1">Weather Vibe</label>
                  <input
                    type="text"
                    value={newWeather}
                    onChange={e => setNewWeather(e.target.value)}
                    placeholder="e.g. Crisp autumn rain"
                    className="w-full px-3 py-1.5 rounded-xl bg-linen-bg border border-linen-border text-linen-primary"
                  />
                </div>
                <div>
                  <label className="block text-linen-primary font-medium mb-1">Song Soundtrack</label>
                  <input
                    type="text"
                    value={newSong}
                    onChange={e => setNewSong(e.target.value)}
                    placeholder="e.g. Mystery of Love"
                    className="w-full px-3 py-1.5 rounded-xl bg-linen-bg border border-linen-border text-linen-primary"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-linen-border flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-linen-border text-linen-secondary hover:bg-linen-variant/40 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-linen-primary text-linen-surface font-medium hover:opacity-90 transition-opacity shadow-xs cursor-pointer"
                >
                  Save Coordinate Pin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
