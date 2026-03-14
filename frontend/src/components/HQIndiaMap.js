import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Map,
  MapMarker,
  MapTooltip,
  MapTileLayer,
  MapMarkerClusterGroup
} from '@/components/ui/map';
import { cn } from '@/lib/utils';

export default function HQIndiaMap({ regions, allOutlets, onRegionSelect, selectedRegion }) {
    // Center of India map roughly:
    const center = [20.5937, 78.9629];
    const zoom = 4.5;

    const getColors = (score) => {
        if (score >= 75) return { raw: '#10b981', glow: 'shadow-emerald-500/50', border: 'border-emerald-500' };
        if (score >= 60) return { raw: '#059669', glow: 'shadow-emerald-600/50', border: 'border-emerald-600' };
        if (score >= 45) return { raw: '#f59e0b', glow: 'shadow-amber-500/50', border: 'border-amber-500' };
        return { raw: '#ef4444', glow: 'shadow-red-500/50', border: 'border-red-500' };
    };

    return (
        <div className="relative w-full aspect-[2/3] max-h-[600px] rounded-xl overflow-hidden shadow-2xl border border-white/5 bg-[#0a0b0f] isolate">
            {/* The shadcn Map uses dynamic import of react-leaflet MapContainer */}
            <Map center={center} zoom={zoom} maxZoom={12} minZoom={3} className="w-full h-full z-0 font-sans">
                <MapTileLayer 
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution="&copy; OpenStreetMap contributors &copy; CARTO"
                />

                <MapMarkerClusterGroup>
                    {allOutlets && allOutlets.map((outlet) => {
                        if (!outlet.coordinates) return null;
                        const { lat, lng } = outlet.coordinates;
                        const colors = getColors(outlet.health_score);
                        const isSelected = selectedRegion?.region === outlet.region;

                        return (
                            <MapMarker 
                                key={outlet.outlet_id}
                                position={[lat, lng]}
                                eventHandlers={{
                                    click: () => onRegionSelect(outlet.region)
                                }}
                                icon={
                                    <div className="relative flex items-center justify-center w-5 h-5 outline-none">
                                        {(isSelected || outlet.health_score < 60) && (
                                            <div 
                                                className={cn("absolute -inset-2 rounded-full border animate-ping opacity-50 z-0", colors.border)} 
                                                style={{ backgroundColor: `${colors.raw}33` }} 
                                            />
                                        )}
                                        <div 
                                            className={cn(
                                                "relative z-10 w-3.5 h-3.5 rounded-full border-2 transition-all duration-300 shadow-lg cursor-pointer",
                                                isSelected ? 'scale-150 ring-2 ring-white ring-offset-2 ring-offset-[#0a0b0f]' : 'hover:scale-125'
                                            )}
                                            style={{ backgroundColor: colors.raw, borderColor: '#0a0b0f' }}
                                        >
                                            <div className="absolute inset-[2px] bg-white/30 rounded-full pointer-events-none" />
                                        </div>
                                    </div>
                                }
                                iconAnchor={[10, 10]}
                            >
                                <MapTooltip 
                                    direction="top" 
                                    offset={[0, -10]} 
                                    className="bg-[#11131a]/95 backdrop-blur-xl border border-white/10 p-3 rounded-xl shadow-2xl z-[1000] text-white"
                                    opacity={1}
                                >
                                    <div className="flex justify-between items-center mb-2 gap-4">
                                        <h4 className="font-bold text-white text-sm m-0">{outlet.outlet_name}</h4>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md text-white" style={{ backgroundColor: colors.raw }}>
                                            {outlet.health_score}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                                        <div className="text-gray-500">City:</div>
                                        <div className="text-indigo-300 font-medium text-right">{outlet.region}</div>
                                        <div className="text-gray-500">NPS:</div>
                                        <div className="text-emerald-400 font-medium text-right font-mono">
                                            {outlet.metrics.nps}
                                        </div>
                                    </div>
                                </MapTooltip>
                            </MapMarker>
                        );
                    })}
                </MapMarkerClusterGroup>
            </Map>
        </div>
    );
}
