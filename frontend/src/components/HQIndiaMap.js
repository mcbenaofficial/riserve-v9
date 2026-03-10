import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// This is a simplified SVG path for India's outline for visualization purposes.
const INDIA_SVG_PATH = "M 152.015 6.002 C 151.748 6.059 151.488 6.136 151.246 6.223 C 148.657 7.159 146.331 9.940 144.110 12.062 C 142.333 13.760 140.793 15.698 139.529 17.818 C 137.951 20.463 138.196 23.543 136.215 25.867 C 134.409 27.986 131.758 29.351 129.560 30.957 C 127.164 32.709 125.109 34.872 122.999 36.917 C 120.932 38.921 118.423 40.525 116.126 42.238 C 114.120 43.733 112.167 45.334 110.169 46.852 C 107.962 48.528 105.748 50.197 103.559 51.898 C 101.464 53.525 99.309 54.918 96.958 56.096 C 94.757 57.200 92.427 58.077 90.134 58.971 C 87.901 59.840 85.669 60.710 83.436 61.579 C 81.350 62.392 79.467 63.856 77.834 65.419 C 75.882 67.287 73.963 69.191 72.036 71.082 C 69.948 73.132 67.756 74.965 65.340 76.623 C 63.090 78.167 60.675 79.357 58.005 80.529 C 55.452 81.649 53.300 83.393 51.109 85.399 C 48.979 87.349 46.902 89.444 44.802 91.433 C 42.664 93.456 40.428 95.341 38.075 96.953 C 35.812 98.503 33.407 100.126 31.066 101.536 C 28.694 102.964 26.248 104.288 23.829 105.629 C 21.631 106.848 19.388 107.989 17.159 109.155 C 15.028 110.269 12.924 111.458 10.871 112.721 C 8.790 113.999 6.840 115.423 4.909 116.883 C 3.109 118.245 1.488 119.827 0.083 121.571 C -1.099 123.037 -0.224 125.101 1.077 126.310 C 2.593 127.719 4.295 128.878 6.002 130.046 C 8.016 131.424 10.038 132.735 12.062 134.095 C 14.154 135.502 16.290 136.877 18.291 138.406 C 20.370 140.000 22.378 141.745 24.167 143.684 C 25.992 145.659 27.674 147.882 28.526 150.395 C 29.350 152.825 31.049 154.516 32.887 156.124 C 34.693 157.705 36.376 159.544 38.053 161.266 C 39.739 162.996 41.341 164.839 42.822 166.757 C 44.402 168.804 45.321 171.218 46.804 173.308 C 48.243 175.337 49.349 177.632 50.811 179.623 C 52.338 181.701 53.791 183.844 55.228 186.001 C 56.666 188.161 58.077 190.354 59.516 192.511 C 60.916 194.611 62.385 196.697 63.858 198.749 C 65.378 200.866 67.090 202.822 68.790 204.792 C 70.476 206.745 72.261 208.729 74.062 210.596 C 75.761 212.358 77.409 214.286 78.966 216.143 C 80.609 218.103 82.262 220.063 83.905 222.023 C 85.541 223.974 87.276 225.869 88.940 227.798 C 90.612 229.735 92.275 231.687 93.945 233.628 C 95.532 235.473 97.432 237.159 99.167 238.868 C 100.912 240.587 102.722 242.067 104.700 243.682 C 106.671 245.289 108.625 246.906 110.600 248.514 C 112.569 250.117 114.542 251.716 116.514 253.315 C 118.525 254.945 120.469 256.467 122.584 257.940 C 124.630 259.364 126.975 260.621 129.215 261.649 C 131.295 262.602 133.582 263.298 135.590 264.407 C 137.608 265.522 139.691 266.909 141.696 268.040 C 143.766 269.208 145.748 270.364 147.886 271.393 C 149.924 272.373 151.705 273.743 153.696 274.881 C 155.632 275.986 157.925 276.732 159.907 277.747 C 161.764 278.697 163.674 279.792 165.592 280.640 C 167.319 281.403 168.991 282.264 170.762 282.935 C 172.587 283.626 174.453 284.281 176.326 284.855 C 178.188 285.424 180.015 285.918 181.869 286.514 C 183.745 287.118 185.597 287.892 187.352 288.583 C 189.155 289.294 191.246 290.046 193.076 290.710 C 193.639 290.915 194.270 290.970 194.869 291.109 C 194.757 289.049 194.618 286.994 194.498 284.935 C 194.391 283.085 194.350 281.232 194.234 279.383 C 194.120 277.531 193.376 275.750 192.548 274.129 C 191.688 272.446 190.528 270.835 189.479 269.243 C 188.461 267.698 187.525 266.079 186.438 264.551 C 185.340 263.003 184.148 261.428 182.880 259.987 C 181.656 258.595 180.403 257.062 179.303 255.577 C 178.204 254.093 177.018 252.392 175.760 251.042 C 174.524 249.715 173.208 248.330 171.776 247.169 C 170.334 245.999 168.807 244.755 167.330 243.518 C 165.879 242.302 164.214 240.407 162.774 239.117 C 161.428 237.910 160.038 236.425 158.599 235.215 C 157.194 234.032 155.614 232.548 154.034 231.547 C 152.195 230.380 150.312 229.214 148.243 227.876 C 146.104 226.492 143.918 225.269 141.769 223.951 C 139.638 222.645 137.893 220.730 135.807 219.467 C 133.722 218.204 131.748 216.711 129.691 215.358 C 127.643 214.011 125.795 212.791 123.711 211.521 C 121.655 210.268 119.578 208.775 117.472 207.502 C 115.385 206.240 113.687 204.595 111.961 202.935 C 110.203 201.243 108.647 199.375 106.918 197.669 C 105.187 195.960 103.524 194.204 101.839 192.457 C 100.161 190.718 98.490 188.983 96.829 187.236 C 95.176 185.498 93.388 183.693 91.716 181.993 C 90.063 180.311 88.580 178.693 86.997 176.942 C 85.390 175.166 84.095 173.197 82.806 171.218 C 81.564 169.310 80.209 167.332 79.141 165.297 C 78.082 163.280 77.291 161.428 76.220 159.418 C 75.151 157.412 74.020 155.679 72.933 153.699 C 71.854 151.734 70.835 149.771 69.807 147.781 C 68.790 145.811 67.766 143.896 66.864 141.871 C 65.955 139.829 64.910 137.890 64.030 135.857 C 63.141 133.804 62.434 131.737 61.642 129.641 C 60.849 127.542 59.957 125.688 59.261 123.559 C 58.583 121.484 57.962 119.387 57.260 117.323 C 56.551 115.239 56.401 113.801 55.452 112.583 C 54.496 111.356 52.887 110.284 51.520 109.117 C 50.147 107.944 48.330 106.314 46.804 105.109 C 45.244 103.878 43.619 102.502 41.970 101.407 C 40.352 100.334 38.673 99.419 37.009 98.412 C 35.405 97.442 33.628 96.082 31.862 95.104 C 30.149 94.156 28.324 93.305 26.564 92.427 C 24.814 91.554 22.973 90.584 21.189 89.754 C 19.336 88.892 17.514 88.007 15.694 87.054 C 13.916 86.124 13.042 84.777 12.062 82.883 C 11.082 80.989 10.368 78.892 9.575 76.892 C 8.814 74.969 8.243 73.160 7.426 71.291 C 6.645 69.502 5.923 67.581 5.233 65.756 C 4.545 63.935 3.961 61.986 3.167 60.222 C 2.378 58.468 1.637 56.883 0.760 55.158 C -0.117 53.434 -0.573 51.488 0.422 49.337 C 1.487 47.036 3.090 45.421 5.233 43.597 C 7.375 41.774 9.079 40.178 11.272 38.393 C 13.438 36.630 15.753 34.919 17.954 33.084 C 20.183 31.226 21.849 29.351 24.053 27.653 C 26.262 25.952 28.695 24.164 30.835 22.443 C 32.946 20.745 34.825 18.995 36.836 17.237 C 38.799 15.522 41.055 13.921 43.109 12.062 C 45.026 10.328 47.965 7.747 50.435 6.666 C 52.886 5.594 56.103 4.512 58.685 3.824 C 61.264 3.136 64.916 2.339 67.491 2.001 C 70.096 1.659 74.521 1.706 77.264 1.884 C 80.010 2.063 84.185 2.126 86.820 2.155 C 89.461 2.185 93.303 2.146 95.942 2.052 C 98.601 1.957 103.543 2.503 105.932 2.658 C 108.311 2.813 111.954 2.812 114.204 2.880 C 116.489 2.948 119.262 3.186 121.262 3.513 C 123.279 3.844 125.798 3.504 127.701 3.513 C 129.589 3.522 131.751 3.208 133.468 3.513 C 135.210 3.823 137.668 4.093 139.309 4.312 C 140.975 4.534 143.601 4.382 145.185 4.654 C 146.782 4.929 150.111 5.378 150.817 5.753 C 151.055 5.879 151.492 5.924 152.015 6.002 Z";

export default function HQIndiaMap({ regions, onRegionSelect, selectedRegion }) {
    const [hoveredRegion, setHoveredRegion] = useState(null);

    // Coordinate mapping to our SVG viewBox scale
    // India is roughly Lat 8°N to 37°N | Lng 68°E to 97°E
    const mapCoordinates = (lat, lng) => {
        // SVG viewBox is "0 0 200 300"
        const minLat = 8;
        const maxLat = 37;
        const minLng = 68;
        const maxLng = 97;

        // X corresponds to Longitude
        const xPercent = (lng - minLng) / (maxLng - minLng);
        // Y corresponds to Latitude (inverted because SVG Y goes down)
        const yPercent = 1 - ((lat - minLat) / (maxLat - minLat));

        return {
            x: xPercent * 200,
            y: yPercent * 300,
        };
    };

    const getColors = (score) => {
        if (score >= 75) return { raw: '#10b981', glow: 'shadow-emerald-500/50', border: 'border-emerald-500' };
        if (score >= 60) return { raw: '#059669', glow: 'shadow-emerald-600/50', border: 'border-emerald-600' };
        if (score >= 45) return { raw: '#f59e0b', glow: 'shadow-amber-500/50', border: 'border-amber-500' };
        return { raw: '#ef4444', glow: 'shadow-red-500/50', border: 'border-red-500' };
    };

    return (
        <div className="relative w-full aspect-[2/3] max-h-[600px] flex items-center justify-center p-4">
            {/* SVG Map Base */}
            <svg
                viewBox="0 0 200 300"
                className="w-full h-full drop-shadow-2xl"
                style={{ filter: "drop-shadow(0px 10px 30px rgba(0,0,0,0.5))" }}
            >
                <path
                    d={INDIA_SVG_PATH}
                    fill="#1e1b4b" // Deep indigo to match HQ theme
                    stroke="#4338ca"
                    strokeWidth="1.5"
                    className="transition-all duration-500"
                    opacity="0.8"
                />
            </svg>

            {/* Render markers */}
            {regions.map((region, idx) => {
                if (!region.coordinates) return null;
                const { x, y } = mapCoordinates(region.coordinates.lat, region.coordinates.lng);
                const colors = getColors(region.avg_health);
                const isSelected = selectedRegion?.region === region.region;
                const isHovered = hoveredRegion?.region === region.region;

                return (
                    <motion.div
                        key={region.region}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.1, type: "spring" }}
                        className="absolute"
                        style={{ left: `${(x / 200) * 100}%`, top: `${(y / 300) * 100}%` }}
                        onMouseEnter={() => setHoveredRegion(region)}
                        onMouseLeave={() => setHoveredRegion(null)}
                        onClick={() => onRegionSelect(region.region)}
                    >
                        {/* Pulse effect for selected or lower health regions */}
                        {(isSelected || region.avg_health < 60) && (
                            <motion.div
                                animate={{ scale: [1, 2.5], opacity: [0.5, 0] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className={`absolute -inset-2 rounded-full border border-current pointer-events-none opacity-20`}
                                style={{ color: colors.raw }}
                            />
                        )}

                        {/* Interactive Marker */}
                        <div
                            className={`relative -ml-2 -mt-2 w-4 h-4 rounded-full cursor-pointer border-2 transition-all duration-300 z-10
                                      ${isSelected ? 'scale-150 ring-2 ring-white ring-offset-2 ring-offset-[#0a0b0f]' : 'hover:scale-125 hover:ring-2 hover:ring-white/50'}
                                      ${colors.glow}`}
                            style={{ backgroundColor: colors.raw, borderColor: '#0a0b0f' }}
                        >
                            {/* Inner dot for detail */}
                            <div className="absolute inset-[3px] bg-white/30 rounded-full" />
                        </div>

                        {/* Hover Tooltip */}
                        <AnimatePresence>
                            {isHovered && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, x: -50 }}
                                    animate={{ opacity: 1, y: 0, x: -50 }}
                                    exit={{ opacity: 0, y: 5 }}
                                    className="absolute bottom-6 min-w-[160px] bg-[#11131a]/95 backdrop-blur-xl border border-white/10 p-3 rounded-xl shadow-2xl z-50 whitespace-nowrap"
                                    style={{ left: '50%' }}
                                    pointerEvents="none"
                                >
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="font-bold text-white text-sm">{region.region}</h4>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md text-white`} style={{ backgroundColor: colors.raw }}>
                                            {region.avg_health}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                                        <div className="text-gray-500">Outlets:</div>
                                        <div className="text-indigo-300 font-medium text-right">{region.outlet_count}</div>
                                        <div className="text-gray-500">Revenue:</div>
                                        <div className="text-emerald-400 font-medium text-right">
                                            ₹{(region.total_revenue_30d / 100000).toFixed(1)}L
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                );
            })}
        </div>
    );
}

// Ensure the viewBox accurately encapsulates the SVG path drawn above.
