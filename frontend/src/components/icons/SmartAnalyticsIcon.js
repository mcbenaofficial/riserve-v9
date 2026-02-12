import React from 'react';
import { BarChart2, Star } from 'lucide-react';

const SmartAnalyticsIcon = ({ size = 20, ...props }) => {
    return (
        <div style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} {...props}>
            <BarChart2 size={size} strokeWidth={2} />
            <div style={{ position: 'absolute', top: -2, right: -2 }}>
                <Star
                    size={size * 0.6}
                    className="text-amber-400"
                    fill="currentColor"
                    strokeWidth={0} // No stroke to look cleaner on top
                />
                {/* Outline for contrast if needed, but simple fill is usually better for star */}
                <Star
                    size={size * 0.6}
                    className="text-amber-400 absolute inset-0"
                    strokeWidth={1.5}
                />
            </div>
        </div>
    );
};
// Simpler version with just one Star
const SmartAnalyticsIconSimple = ({ size = 20, className, ...props }) => {
    return (
        <div className={className} style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} {...props}>
            <BarChart2 size={size} strokeWidth={2} className="relative z-0" />
            <Star
                size={size * 0.5}
                className="absolute -top-1 -right-2 text-amber-500 fill-amber-500 z-10"
                strokeWidth={1}
            />
        </div>
    );
};

export default SmartAnalyticsIconSimple;
