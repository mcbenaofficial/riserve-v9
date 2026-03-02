// src/data/mockFlows.js

const createNode = (id, type, label, x, y, isDark = true) => ({
    id,
    type: 'custom',
    position: { x, y },
    data: { label, nodeType: type, config: {}, isDark }
});

const createNoteNode = (id, label, text, x, y, isDark = true) => ({
    id,
    type: 'custom',
    position: { x, y },
    data: {
        label,
        nodeType: 'note',
        config: { text },
        isDark
    }
});

const createEdge = (source, target) => ({
    id: `e${source}-${target}`,
    source,
    target,
    animated: true,
    style: { stroke: '#8b5cf6', strokeWidth: 2 },
    type: 'smoothstep'
});

export const MOCK_FLOWS = [
    {
        id: 'ai-flow-1',
        name: 'Autonomous No-Show Mitigation',
        description: 'If no-show occurs, Revenue agent reschedules or fills with waitlist clients autonomously. Integrates with voice concierge for real-time confirmations.',
        status: 'active',
        lastRun: '12 mins ago',
        runs: 45,
        successRate: 98.2,
        createdAt: '2026-02-20',
        nodeCount: 5,
        template: 'custom',
        nodes: [
            createNoteNode('note-1', 'Instructions', 'Configure the Triage Agent to listen to the Bookings API for "no-show" events. The Voice Concierge tool needs your Twilio API key in the Settings page.', 50, 50),
            createNode('n1', 'input', 'Booking Webhook', 50, 200),
            createNode('n2', 'agent', 'Triage Agent', 300, 200),
            createNode('n3', 'condition', 'Is Waitlist Full?', 550, 150),
            createNode('n4', 'tool', 'Voice Concierge SMS', 800, 100),
            createNode('n5', 'agent', 'Revenue Agent (Discount)', 800, 280),
        ],
        edges: [
            createEdge('n1', 'n2'),
            createEdge('n2', 'n3'),
            { ...createEdge('n3', 'n4'), sourceHandle: 'true' },
            { ...createEdge('n3', 'n5'), sourceHandle: 'false' }
        ]
    },
    {
        id: 'ai-flow-2',
        name: 'Dynamic Inventory Reordering',
        description: 'Inventory agent monitors stock, predicts demand. Collaborates with Revenue agent to factor in promotions; logs overrides.',
        status: 'active',
        lastRun: '1 hour ago',
        runs: 12,
        successRate: 100,
        createdAt: '2026-02-21',
        nodeCount: 4,
        template: 'custom',
        nodes: [
            createNoteNode('note-1', 'Instructions', 'Set the threshold levels in the Inventory DB. The Supplier API node requires OAuth connection to your vendor accounts (e.g. L\'Oreal, Wella).', 50, 50),
            createNode('n1', 'retriever', 'Inventory DB', 50, 200),
            createNode('n2', 'agent', 'Inventory Agent', 300, 200),
            createNode('n3', 'http', 'Supplier API Checkout', 550, 200),
            createNode('n4', 'output', 'Admin Notification', 800, 200),
        ],
        edges: [
            createEdge('n1', 'n2'),
            createEdge('n2', 'n3'),
            createEdge('n3', 'n4')
        ]
    },
    {
        id: 'ai-flow-3',
        name: 'Personalized Upsell Orchestration',
        description: 'CRM agent analyzes history. Revenue agent decides upsell opportunities. Bookings agent executes; updates finance in real-time.',
        status: 'paused',
        lastRun: 'Never',
        runs: 0,
        successRate: 0,
        createdAt: '2026-02-22',
        nodeCount: 6,
        template: 'custom',
        nodes: [
            createNoteNode('note-1', 'Instructions', 'This flow intercepts the booking widget. Needs to be tested in Sandbox mode first. Configure the Prompt Template with your specific salon/spa service combinations.', 50, 50),
            createNode('n1', 'input', 'Pre-Checkout Hook', 50, 250),
            createNode('n2', 'memory', 'CRM History', 50, 150),
            createNode('n3', 'agent', 'CRM Agent', 300, 200),
            createNode('n4', 'agent', 'Revenue Agent', 550, 200),
            createNode('n5', 'prompt', 'Upsell Generator', 550, 100),
            createNode('n6', 'output', 'UI Widget Injection', 800, 200),
        ],
        edges: [
            createEdge('n1', 'n3'),
            createEdge('n2', 'n3'),
            createEdge('n3', 'n4'),
            createEdge('n5', 'n4'),
            createEdge('n4', 'n6')
        ]
    },
    {
        id: 'ai-flow-4',
        name: 'Staff Scheduling Optimization',
        description: 'Triage agent scans bookings. Staff agent assigns shifts based on skills and performance, handling swaps or overtime autonomously.',
        status: 'active',
        lastRun: '5 mins ago',
        runs: 24,
        successRate: 95.8,
        createdAt: '2026-02-23',
        nodeCount: 5,
        template: 'custom',
        nodes: [
            createNoteNode('note-1', 'Instructions', 'Ensure all staff profiles have their "Skills" tags filled out. The optimization script runs every Sunday at midnight by default.', 50, 50),
            createNode('n1', 'time', 'Weekly Cron Job', 50, 200),
            createNode('n2', 'retriever', 'Bookings Forecast', 300, 120),
            createNode('n3', 'retriever', 'Staff Availability', 300, 280),
            createNode('n4', 'agent', 'Staff Agent', 550, 200),
            createNode('n5', 'tool', 'Update Roster API', 800, 200),
        ],
        edges: [
            createEdge('n1', 'n4'),
            createEdge('n2', 'n4'),
            createEdge('n3', 'n4'),
            createEdge('n4', 'n5')
        ]
    },
    {
        id: 'ai-flow-5',
        name: 'Automated Financial Reconciliation',
        description: 'Finance agent reconciles bookings/payments daily, detects anomalies. Collaborates with Inventory for expense tracking.',
        status: 'active',
        lastRun: 'Yesterday',
        runs: 1,
        successRate: 100,
        createdAt: '2026-02-24',
        nodeCount: 6,
        template: 'custom',
        nodes: [
            createNoteNode('note-1', 'Instructions', 'Connect your Stripe and Square accounts in the Integrations tab so the Finance Agent can cross-reference POS data with online bookings.', 50, 50),
            createNode('n1', 'time', 'Daily EOD Trigger', 50, 200),
            createNode('n2', 'http', 'Stripe API', 300, 100),
            createNode('n3', 'retriever', 'Internal Bookings', 300, 300),
            createNode('n4', 'agent', 'Finance Agent', 550, 200),
            createNode('n5', 'condition', 'Mismatch > $0.00?', 800, 200),
            createNode('n6', 'output', 'Flag for Human Review', 1050, 150),
        ],
        edges: [
            createEdge('n1', 'n4'),
            createEdge('n2', 'n4'),
            createEdge('n3', 'n4'),
            createEdge('n4', 'n5'),
            { ...createEdge('n5', 'n6'), sourceHandle: 'true' }
        ]
    },
    {
        id: 'ai-flow-6',
        name: 'Churn Prediction and Retention',
        description: 'Feedback/CRM agents analyze patterns. Revenue agent triggers offers, voice check-ins, or reschedules via swarm handoffs.',
        status: 'active',
        lastRun: '15 mins ago',
        runs: 8,
        successRate: 88.5,
        createdAt: '2026-02-20',
        nodeCount: 5,
        template: 'custom',
        nodes: [
            createNoteNode('note-1', 'Instructions', 'The Vector Store holds historical churn data. Adjust the temperature on the LLM node if the retention offers generated seem too aggressive.', 50, 50),
            createNode('n1', 'retriever', 'Customer Activity Log', 50, 200),
            createNode('n2', 'agent', 'CRM Agent (Analyst)', 300, 200),
            createNode('n3', 'condition', 'Churn Risk > 75%?', 550, 200),
            createNode('n4', 'llm', 'Offer Generator', 800, 100),
            createNode('n5', 'tool', 'SendGrid Email API', 1050, 100),
        ],
        edges: [
            createEdge('n1', 'n2'),
            createEdge('n2', 'n3'),
            { ...createEdge('n3', 'n4'), sourceHandle: 'true' },
            createEdge('n4', 'n5')
        ]
    },
    {
        id: 'ai-flow-7',
        name: 'Dynamic Pricing Adjustment',
        description: 'Revenue agent monitors demand. Collaborates with Bookings to adjust rates (e.g., surge for busy slots), ensuring RBAC limits.',
        status: 'paused',
        lastRun: 'Never',
        runs: 0,
        successRate: 0,
        createdAt: '2026-02-21',
        nodeCount: 5,
        template: 'custom',
        nodes: [
            createNoteNode('note-1', 'Instructions', 'Set upper bounds in the Pricing Parameters node so surge pricing never exceeds +25% of base rate. Awaiting Manager approval to activate.', 50, 50),
            createNode('n1', 'retriever', 'Live Booking Traffic', 50, 200),
            createNode('n2', 'agent', 'Revenue Agent', 300, 200),
            createNode('n3', 'prompt', 'Pricing Rules', 300, 100),
            createNode('n4', 'human', 'Manager Approval (HITL)', 550, 200),
            createNode('n5', 'tool', 'Update Pricing DB', 800, 200),
        ],
        edges: [
            createEdge('n1', 'n2'),
            createEdge('n3', 'n2'),
            createEdge('n2', 'n4'),
            createEdge('n4', 'n5')
        ]
    },
    {
        id: 'ai-flow-8',
        name: 'Lead Qualification and Onboarding',
        description: 'Triage agent scores leads. CRM agent qualifies via automated outreach; Bookings executes initial scheduling.',
        status: 'active',
        lastRun: '10 mins ago',
        runs: 18,
        successRate: 91.2,
        createdAt: '2026-02-22',
        nodeCount: 4,
        template: 'custom',
        nodes: [
            createNoteNode('note-1', 'Instructions', 'Connect this flow to your landing page form via Webhook. Use the SMS tool for leads who provide a valid phone number.', 50, 50),
            createNode('n1', 'http', 'Webhook (Typeform)', 50, 200),
            createNode('n2', 'agent', 'Triage Agent (Scorer)', 300, 200),
            createNode('n3', 'router', 'Route logic (Score > 50)', 550, 200),
            createNode('n4', 'agent', 'Onboarding Assistant', 800, 150),
        ],
        edges: [
            createEdge('n1', 'n2'),
            createEdge('n2', 'n3'),
            { ...createEdge('n3', 'n4'), sourceHandle: 'true' }
        ]
    },
    {
        id: 'ai-flow-9',
        name: 'Marketing Automation Triggers',
        description: 'AI analyzes feedback to generate campaigns with A/B testing. Ties into your whitelabel pages for targeted outreach.',
        status: 'active',
        lastRun: '4 hours ago',
        runs: 42,
        successRate: 96.0,
        createdAt: '2026-02-23',
        nodeCount: 6,
        template: 'custom',
        nodes: [
            createNoteNode('note-1', 'Instructions', 'Provide 3 base templates for the A/B test generator. The Audience segmenter uses K-means clustering on customer spend history.', 50, 50),
            createNode('n1', 'time', 'Monthly Trigger', 50, 200),
            createNode('n2', 'retriever', 'Feedback / Review DB', 300, 120),
            createNode('n3', 'code', 'Python (Clustering)', 300, 280),
            createNode('n4', 'llm', 'Copy Generator', 550, 200),
            createNode('n5', 'tool', 'SendGrid / Klaviyo', 800, 150),
            createNode('n6', 'tool', 'Facebook Ads API', 800, 250),
        ],
        edges: [
            createEdge('n1', 'n4'),
            createEdge('n2', 'n4'),
            createEdge('n3', 'n4'),
            createEdge('n4', 'n5'),
            createEdge('n4', 'n6')
        ]
    },
    {
        id: 'ai-flow-10',
        name: 'Sustainability Tracker',
        description: 'AI monitors inventory/finance for eco-metrics (e.g., waste reduction suggestions), appealing to modern SMBs.',
        status: 'paused',
        lastRun: 'Never',
        runs: 0,
        successRate: 0,
        createdAt: '2026-02-24',
        nodeCount: 4,
        template: 'custom',
        nodes: [
            createNoteNode('note-1', 'Instructions', 'Set up the carbon weight formulas in the Custom Code node. Connects directly to the Dashboard to render eco-badges.', 50, 50),
            createNode('n1', 'retriever', 'Inventory Depletion Logs', 50, 200),
            createNode('n2', 'code', 'Calculate Carbon Offset', 300, 200),
            createNode('n3', 'agent', 'Sustainability Agent', 550, 200),
            createNode('n4', 'output', 'Dashboard Widget Update', 800, 200),
        ],
        edges: [
            createEdge('n1', 'n2'),
            createEdge('n2', 'n3'),
            createEdge('n3', 'n4')
        ]
    },
    {
        id: 'ai-flow-11',
        name: 'Predictive Analytics Dashboards',
        description: 'Generate revenue forecasts, staff performance metrics, churn risk flags, and demand heatmaps for multi-locations.',
        status: 'active',
        lastRun: '12 hours ago',
        runs: 144,
        successRate: 99.5,
        createdAt: '2026-02-25',
        nodeCount: 5,
        template: 'custom',
        nodes: [
            createNoteNode('note-1', 'Instructions', 'Runs overnight to pre-compute heavy SQL queries for the morning dashboard. Ensure Snowflake/BigQuery API credentials are valid.', 50, 50),
            createNode('n1', 'time', 'Nightly Batch (2 AM)', 50, 200),
            createNode('n2', 'agent', 'Data Analyst Agent', 300, 200),
            createNode('n3', 'tool', 'Execute SQL Store Proc', 550, 100),
            createNode('n4', 'llm', 'Generate Summary Text', 550, 300),
            createNode('n5', 'output', 'Cache to Redis', 800, 200),
        ],
        edges: [
            createEdge('n1', 'n2'),
            createEdge('n2', 'n3'),
            createEdge('n2', 'n4'),
            createEdge('n3', 'n5'),
            createEdge('n4', 'n5')
        ]
    }
];
