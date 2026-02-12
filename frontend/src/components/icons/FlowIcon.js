import React from 'react';

const FlowIcon = ({ size = 20, color = "currentColor", strokeWidth = 2, ...props }) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <path d="M12 21a9 9 0 0 0 9-9 9 9 0 0 0-9-9 9 9 0 0 0-9 9" opacity="0" /> {/* Hidden circle for sizing reference if needed, but paths below define the shape */}
            {/* Top curved arrow pointing right/down */}
            <path d="M16.5 4.5a8 8 0 0 1 3.5 8c0 2-1 4-2.5 5.5" />
            <path d="M12 3a9 9 0 0 1 9 9" stroke="transparent" /> {/* Spacer */}

            {/* Custom paths for the two thick curved arrows */}
            <path d="M7 20l-4-4" />
            <path d="M3 20l4-4" />
            <path d="M21 4l-4 4" />
            <path d="M17 4l4 4" />

            {/* Wait, let's use a cleaner path resembling 'RefreshCw' but customized or 'Repeat' */}
            {/* Simulating the user's "two arrows circle" image specifically */}
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 21h5v-5" />
        </svg>
    );
};

// Alternative: A more stylized version closer to "infinity" or "process flow"
const FlowIconStyled = ({ size = 20, color = "currentColor", ...props }) => {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <path d="M18 4l3 3l-3 3" /> {/* Arrow Top Right */}
            <path d="M6 20l-3-3l3-3" /> {/* Arrow Bottom Left */}

            {/* Top Curve */}
            <path d="M21 7a9 9 0 0 0-9-9 8.6 8.6 0 0 0-6 2.5l-3 1.5" />
            {/* Wait, standard arcs are better */}

            <path d="M21 7a9 9 0 0 0-11-2 8 8 0 0 0-7 9" />
            <path d="M3 17a9 9 0 0 0 11 2 8 8 0 0 0 7-9" />
        </svg>
    );
};

// Let's stick to standard Lucide 'refresh-cw' visual but maybe thicker or properly oriented?
// The user image looks like 'RefreshCw' (clockwise arrows).
// Let's implement a clean version.

const FlowIconClean = ({ size = 20, color = "currentColor", ...props }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
    >
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" opacity="0" /> {/* bounding box filler */}
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
        <path d="M8 21H3v-5" />
    </svg>
);

export default FlowIconClean;
