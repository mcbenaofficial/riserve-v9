import React, { useState, useCallback, useMemo } from 'react';
import ReactFlow, {
    addEdge,
    Background,
    Controls,
    MiniMap,
    Handle,
    Position,
    useNodesState,
    useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';
import {
    GitBranch, Plus, Play, Pause, Save, Settings, Trash2,
    MessageSquare, Database, Zap, Bot, ArrowRight,
    Sparkles, Code, FileText, Search, Filter, X,
    ChevronRight, ChevronDown, GripVertical, Copy,
    ArrowDownCircle, Brain, GitFork, Repeat, Wand2,
    Globe, Route, User, CircleDot, CheckCircle2, AlertCircle, Loader2
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { MOCK_FLOWS } from '../data/mockFlows';

// Expanded Node types for the agent builder
const NODE_TYPES = [
    // Core Nodes
    { type: 'input', label: 'Input', icon: ArrowDownCircle, color: '#22c55e', description: 'Flow entry point', category: 'core' },
    { type: 'output', label: 'Output', icon: FileText, color: '#6366f1', description: 'Output Parser', category: 'core' },

    // AI Nodes
    { type: 'llm', label: 'LLM', icon: Bot, color: '#8b5cf6', description: 'Language Model', category: 'ai' },
    { type: 'prompt', label: 'Prompt', icon: MessageSquare, color: '#ec4899', description: 'Prompt Template', category: 'ai' },
    { type: 'agent', label: 'Agent', icon: Sparkles, color: '#f97316', description: 'AI Agent', category: 'ai' },

    // Data Nodes
    { type: 'retriever', label: 'Retriever', icon: Database, color: '#3b82f6', description: 'Vector Store', category: 'data' },
    { type: 'memory', label: 'Memory', icon: Brain, color: '#a855f7', description: 'Conversation Memory', category: 'data' },
    { type: 'transform', label: 'Transform', icon: Wand2, color: '#14b8a6', description: 'Data Transformer', category: 'data' },

    // Logic Nodes
    { type: 'condition', label: 'Condition', icon: GitFork, color: '#eab308', description: 'If/Else Branch', category: 'logic' },
    { type: 'loop', label: 'Loop', icon: Repeat, color: '#f59e0b', description: 'Iterator/Loop', category: 'logic' },
    { type: 'router', label: 'Router', icon: Route, color: '#64748b', description: 'Route Switch', category: 'logic' },
    { type: 'chain', label: 'Chain', icon: GitBranch, color: '#10b981', description: 'Sequence Chain', category: 'logic' },

    // Integration Nodes
    { type: 'tool', label: 'Tool', icon: Zap, color: '#f59e0b', description: 'External Tool/API', category: 'integration' },
    { type: 'http', label: 'HTTP', icon: Globe, color: '#0ea5e9', description: 'HTTP Request', category: 'integration' },
    { type: 'code', label: 'Code', icon: Code, color: '#71717a', description: 'Custom Code', category: 'integration' },

    // Human Nodes
    { type: 'human', label: 'Human', icon: User, color: '#06b6d4', description: 'Human-in-the-Loop', category: 'human' },

    // Special Nodes
    { type: 'note', label: 'Sticky Note', icon: FileText, color: '#fef08a', description: 'Instructional Note', category: 'core' },
];

const CATEGORIES = [
    { id: 'core', label: 'Core' },
    { id: 'ai', label: 'AI & Language' },
    { id: 'data', label: 'Data & Memory' },
    { id: 'logic', label: 'Logic & Control' },
    { id: 'integration', label: 'Integration' },
    { id: 'human', label: 'Human' },
];

// Sample templates
const TEMPLATES = [
    { id: 'rag', name: 'RAG Agent', description: 'Retrieval Augmented Generation', nodes: 5 },
    { id: 'chat', name: 'Chat Agent', description: 'Conversational AI Agent', nodes: 4 },
    { id: 'tool', name: 'Tool Agent', description: 'Agent with External Tools', nodes: 6 },
    { id: 'custom', name: 'Custom Flow', description: 'Start from scratch', nodes: 0 },
];

// Custom Node Component
const CustomNode = ({ data, selected }) => {
    const nodeType = NODE_TYPES.find(t => t.type === data.nodeType) || NODE_TYPES[0];
    const IconComponent = nodeType.icon;
    const isDark = data.isDark !== false; // default to dark if not set

    return (
        <div
            className={`${isDark ? 'bg-[#1F2630]' : 'bg-white'} border-2 rounded-xl p-4 min-w-[180px] transition-all ${selected
                ? 'border-purple-500 shadow-lg shadow-purple-500/20'
                : isDark ? 'border-[#374151] hover:border-[#4B5563]' : 'border-[#D9DEE5] hover:border-[#9CA3AF]'
                }`}
        >
            {/* Input Handle */}
            {data.nodeType !== 'input' && (
                <Handle
                    type="target"
                    position={Position.Left}
                    className={`!w-4 !h-4 ${isDark ? '!bg-[#374151] !border-[#4B5563]' : '!bg-[#D9DEE5] !border-[#9CA3AF]'} !border-2 hover:!border-purple-500 transition-colors`}
                />
            )}

            <div className="flex items-center gap-3">
                <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${nodeType.color}20` }}
                >
                    <IconComponent size={16} style={{ color: nodeType.color }} />
                </div>
                <div className="flex-1">
                    <h4 className={`text-sm font-semibold ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>{data.label || nodeType.label}</h4>
                    <p className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>{nodeType.description}</p>
                </div>
            </div>

            {/* Output Handle */}
            {data.nodeType !== 'output' && (
                <Handle
                    type="source"
                    position={Position.Right}
                    className={`!w-4 !h-4 ${isDark ? '!bg-[#374151] !border-[#4B5563]' : '!bg-[#D9DEE5] !border-[#9CA3AF]'} !border-2 hover:!border-purple-500 transition-colors`}
                />
            )}

            {/* Condition node has two outputs */}
            {data.nodeType === 'condition' && (
                <>
                    <Handle
                        type="source"
                        position={Position.Right}
                        id="true"
                        style={{ top: '35%' }}
                        className="!w-4 !h-4 !bg-green-500/50 !border-2 !border-green-500"
                    />
                    <Handle
                        type="source"
                        position={Position.Right}
                        id="false"
                        style={{ top: '65%' }}
                        className="!w-4 !h-4 !bg-red-500/50 !border-2 !border-red-500"
                    />
                </>
            )}
        </div>
    );
};

// Sticky Note Component
const StickyNoteNode = ({ data, selected }) => {
    return (
        <div
            className={`min-w-[220px] max-w-[300px] p-4 rounded-md shadow-md transition-all ${selected ? 'ring-2 ring-yellow-400 ring-offset-2' : ''
                }`}
            style={{
                backgroundColor: '#fef3c7', // Warm yellow
                borderLeft: '4px solid #f59e0b', // Amber edge
                color: '#1c1917', // Dark gray text
                fontFamily: "'Comic Sans MS', 'Chalkboard SE', 'Marker Felt', sans-serif"
            }}
        >
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-amber-200/50">
                <FileText size={16} className="text-amber-600" />
                <h4 className="font-bold text-sm tracking-wide text-amber-900 uppercase">{data.label || 'Note'}</h4>
            </div>
            <p className="text-sm leading-snug whitespace-pre-wrap">
                {data.config?.text || 'Write your instructions here...'}
            </p>
        </div>
    );
};

// Define nodeTypes outside component to prevent re-renders
const nodeTypes = {
    custom: CustomNode,
    note: StickyNoteNode,
};

const Flow = () => {
    const { id } = useParams();
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const navigate = useNavigate();

    // Check if we're loading a specific flow
    const initialFlow = useMemo(() => {
        if (id) {
            return MOCK_FLOWS.find(f => f.id === id);
        }
        return null;
    }, [id]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialFlow?.nodes || []);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlow?.edges || []);
    const [selectedNode, setSelectedNode] = useState(null);
    const [showTemplates, setShowTemplates] = useState(!initialFlow);
    const [showNodePalette, setShowNodePalette] = useState(true);
    const [flowName, setFlowName] = useState(initialFlow?.name || 'Untitled Flow');
    const [isRunning, setIsRunning] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState(['core', 'ai']);

    // New state for Save, Templates modal, and Run
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [runProgress, setRunProgress] = useState(0);
    const [runStatus, setRunStatus] = useState(null); // 'running', 'success', 'error'
    const [runLog, setRunLog] = useState([]);

    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge({
            ...params,
            animated: true,
            style: { stroke: '#8b5cf6', strokeWidth: 2 },
            type: 'smoothstep',
        }, eds)),
        [setEdges]
    );

    const onNodeClick = useCallback((event, node) => {
        setSelectedNode(node.id);
    }, []);

    const addNode = useCallback((type, x = 300, y = 200) => {
        const nodeType = NODE_TYPES.find(t => t.type === type);
        const newNode = {
            id: `node-${Date.now()}`,
            type: 'custom',
            position: { x: x + Math.random() * 50, y: y + Math.random() * 50 },
            data: {
                label: nodeType?.label || 'Node',
                nodeType: type,
                config: {},
                isDark: theme === 'dark'
            }
        };
        setNodes(prev => [...prev, newNode]);
        setSelectedNode(newNode.id);
        setShowTemplates(false);
    }, [setNodes, theme]);

    const deleteNode = useCallback((nodeId) => {
        setNodes(prev => prev.filter(n => n.id !== nodeId));
        setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));
        if (selectedNode === nodeId) setSelectedNode(null);
    }, [selectedNode, setNodes, setEdges]);

    const handleDragStart = (e, nodeType) => {
        e.dataTransfer.setData('nodeType', nodeType);
        e.dataTransfer.effectAllowed = 'move';
    };

    const onDrop = useCallback((event) => {
        event.preventDefault();
        const nodeType = event.dataTransfer.getData('nodeType');
        if (!nodeType) return;

        const reactFlowBounds = event.target.getBoundingClientRect();
        const position = {
            x: event.clientX - reactFlowBounds.left - 90,
            y: event.clientY - reactFlowBounds.top - 30,
        };

        addNode(nodeType, position.x, position.y);
    }, [addNode]);

    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    // Update isDark on all nodes when theme changes
    React.useEffect(() => {
        setNodes(prev => prev.map(n => ({
            ...n,
            data: { ...n.data, isDark: theme === 'dark' }
        })));
    }, [theme, setNodes]);

    const loadTemplate = (templateId) => {
        const isDarkNow = theme === 'dark';
        const templateConfigs = {
            'rag': {
                nodes: [
                    { id: 'n1', type: 'custom', position: { x: 50, y: 150 }, data: { label: 'User Query', nodeType: 'input', config: {}, isDark: isDarkNow } },
                    { id: 'n2', type: 'custom', position: { x: 280, y: 80 }, data: { label: 'Vector Store', nodeType: 'retriever', config: {}, isDark: isDarkNow } },
                    { id: 'n3', type: 'custom', position: { x: 280, y: 220 }, data: { label: 'RAG Prompt', nodeType: 'prompt', config: {}, isDark: isDarkNow } },
                    { id: 'n4', type: 'custom', position: { x: 520, y: 150 }, data: { label: 'GPT-4', nodeType: 'llm', config: {}, isDark: isDarkNow } },
                    { id: 'n5', type: 'custom', position: { x: 760, y: 150 }, data: { label: 'Response', nodeType: 'output', config: {}, isDark: isDarkNow } },
                ],
                edges: [
                    { id: 'e1-2', source: 'n1', target: 'n2', animated: true, style: { stroke: '#8b5cf6', strokeWidth: 2 }, type: 'smoothstep' },
                    { id: 'e1-3', source: 'n1', target: 'n3', animated: true, style: { stroke: '#8b5cf6', strokeWidth: 2 }, type: 'smoothstep' },
                    { id: 'e2-4', source: 'n2', target: 'n4', animated: true, style: { stroke: '#8b5cf6', strokeWidth: 2 }, type: 'smoothstep' },
                    { id: 'e3-4', source: 'n3', target: 'n4', animated: true, style: { stroke: '#8b5cf6', strokeWidth: 2 }, type: 'smoothstep' },
                    { id: 'e4-5', source: 'n4', target: 'n5', animated: true, style: { stroke: '#8b5cf6', strokeWidth: 2 }, type: 'smoothstep' },
                ]
            },
            'chat': {
                nodes: [
                    { id: 'n1', type: 'custom', position: { x: 50, y: 150 }, data: { label: 'User Input', nodeType: 'input', config: {}, isDark: isDarkNow } },
                    { id: 'n2', type: 'custom', position: { x: 280, y: 80 }, data: { label: 'Chat Memory', nodeType: 'memory', config: {}, isDark: isDarkNow } },
                    { id: 'n3', type: 'custom', position: { x: 280, y: 220 }, data: { label: 'Chat Prompt', nodeType: 'prompt', config: {}, isDark: isDarkNow } },
                    { id: 'n4', type: 'custom', position: { x: 520, y: 150 }, data: { label: 'GPT-4', nodeType: 'llm', config: {}, isDark: isDarkNow } },
                    { id: 'n5', type: 'custom', position: { x: 760, y: 150 }, data: { label: 'Response', nodeType: 'output', config: {}, isDark: isDarkNow } },
                ],
                edges: [
                    { id: 'e1-2', source: 'n1', target: 'n2', animated: true, style: { stroke: '#8b5cf6', strokeWidth: 2 }, type: 'smoothstep' },
                    { id: 'e1-3', source: 'n1', target: 'n3', animated: true, style: { stroke: '#8b5cf6', strokeWidth: 2 }, type: 'smoothstep' },
                    { id: 'e2-4', source: 'n2', target: 'n4', animated: true, style: { stroke: '#8b5cf6', strokeWidth: 2 }, type: 'smoothstep' },
                    { id: 'e3-4', source: 'n3', target: 'n4', animated: true, style: { stroke: '#8b5cf6', strokeWidth: 2 }, type: 'smoothstep' },
                    { id: 'e4-5', source: 'n4', target: 'n5', animated: true, style: { stroke: '#8b5cf6', strokeWidth: 2 }, type: 'smoothstep' },
                ]
            },
            'tool': {
                nodes: [
                    { id: 'n1', type: 'custom', position: { x: 50, y: 180 }, data: { label: 'User Query', nodeType: 'input', config: {}, isDark: isDarkNow } },
                    { id: 'n2', type: 'custom', position: { x: 280, y: 180 }, data: { label: 'Agent', nodeType: 'agent', config: {}, isDark: isDarkNow } },
                    { id: 'n3', type: 'custom', position: { x: 500, y: 80 }, data: { label: 'Search API', nodeType: 'tool', config: {}, isDark: isDarkNow } },
                    { id: 'n4', type: 'custom', position: { x: 500, y: 180 }, data: { label: 'Calculator', nodeType: 'tool', config: {}, isDark: isDarkNow } },
                    { id: 'n5', type: 'custom', position: { x: 500, y: 280 }, data: { label: 'Weather API', nodeType: 'http', config: {}, isDark: isDarkNow } },
                    { id: 'n6', type: 'custom', position: { x: 740, y: 180 }, data: { label: 'Response', nodeType: 'output', config: {}, isDark: isDarkNow } },
                ],
                edges: [
                    { id: 'e1-2', source: 'n1', target: 'n2', animated: true, style: { stroke: '#8b5cf6', strokeWidth: 2 }, type: 'smoothstep' },
                    { id: 'e2-3', source: 'n2', target: 'n3', animated: true, style: { stroke: '#8b5cf6', strokeWidth: 2 }, type: 'smoothstep' },
                    { id: 'e2-4', source: 'n2', target: 'n4', animated: true, style: { stroke: '#8b5cf6', strokeWidth: 2 }, type: 'smoothstep' },
                    { id: 'e2-5', source: 'n2', target: 'n5', animated: true, style: { stroke: '#8b5cf6', strokeWidth: 2 }, type: 'smoothstep' },
                    { id: 'e3-6', source: 'n3', target: 'n6', animated: true, style: { stroke: '#8b5cf6', strokeWidth: 2 }, type: 'smoothstep' },
                    { id: 'e4-6', source: 'n4', target: 'n6', animated: true, style: { stroke: '#8b5cf6', strokeWidth: 2 }, type: 'smoothstep' },
                    { id: 'e5-6', source: 'n5', target: 'n6', animated: true, style: { stroke: '#8b5cf6', strokeWidth: 2 }, type: 'smoothstep' },
                ]
            },
            'custom': { nodes: [], edges: [] }
        };

        const template = templateConfigs[templateId] || { nodes: [], edges: [] };
        setNodes(template.nodes);
        setEdges(template.edges);
        setShowTemplates(false);
        setFlowName(TEMPLATES.find(t => t.id === templateId)?.name || 'Custom Flow');
    };

    const toggleCategory = (categoryId) => {
        setExpandedCategories(prev =>
            prev.includes(categoryId)
                ? prev.filter(c => c !== categoryId)
                : [...prev, categoryId]
        );
    };

    // Save Flow Handler
    const handleSaveFlow = async () => {
        setIsSaving(true);
        setSaveSuccess(false);

        const flowData = {
            id: `flow-${Date.now()}`,
            name: flowName,
            nodes: nodes,
            edges: edges,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Save to localStorage
        const savedFlows = JSON.parse(localStorage.getItem('riserve_flows') || '[]');
        savedFlows.push(flowData);
        localStorage.setItem('riserve_flows', JSON.stringify(savedFlows));

        setIsSaving(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
    };

    // Run Flow Handler
    const handleRunFlow = async () => {
        if (nodes.length === 0) {
            setRunStatus('error');
            setRunLog(['Error: No nodes in flow']);
            return;
        }

        setIsRunning(true);
        setRunStatus('running');
        setRunProgress(0);
        setRunLog([]);

        // Simulate running through nodes
        const nodeLabels = nodes.map(n => n.data.label);
        for (let i = 0; i < nodeLabels.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 600));
            setRunProgress(((i + 1) / nodeLabels.length) * 100);
            setRunLog(prev => [...prev, `✓ Executed: ${nodeLabels[i]}`]);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
        setRunStatus('success');
        setIsRunning(false);
    };

    // Stop Flow Handler
    const handleStopFlow = () => {
        setIsRunning(false);
        setRunStatus(null);
        setRunProgress(0);
        setRunLog([]);
    };

    const selectedNodeData = useMemo(() => {
        return nodes.find(n => n.id === selectedNode);
    }, [nodes, selectedNode]);

    return (
        <div className={`flex h-screen ${isDark ? 'bg-[#0B0D10]' : 'bg-[#F6F7F9]'} ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'} overflow-hidden`}>

            {/* Left Sidebar - Node Palette */}
            <AnimatePresence>
                {showNodePalette && (
                    <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 280, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        className={`h-full ${isDark ? 'bg-[#12161C] border-[#1F2630]' : 'bg-white border-[#D9DEE5]'} border-r flex flex-col overflow-hidden`}
                    >
                        <div className={`p-4 border-b ${isDark ? 'border-[#1F2630]' : 'border-[#D9DEE5]'}`}>
                            <h2 className={`text-lg font-semibold ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'} flex items-center gap-2`}>
                                <GitBranch size={20} className="text-purple-400" />
                                Flow Builder
                            </h2>
                            <p className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} mt-1`}>Drag nodes to the canvas</p>
                        </div>

                        <div className="flex-1 p-4 overflow-y-auto">
                            {CATEGORIES.map((category) => (
                                <div key={category.id} className="mb-4">
                                    <button
                                        onClick={() => toggleCategory(category.id)}
                                        className={`flex items-center gap-2 w-full text-left text-xs font-semibold ${isDark ? 'text-[#7D8590] hover:text-[#E6E8EB]' : 'text-[#6B7280] hover:text-[#0E1116]'} uppercase tracking-wider mb-2 transition-colors`}
                                    >
                                        {expandedCategories.includes(category.id) ? (
                                            <ChevronDown size={14} />
                                        ) : (
                                            <ChevronRight size={14} />
                                        )}
                                        {category.label}
                                    </button>

                                    <AnimatePresence>
                                        {expandedCategories.includes(category.id) && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="space-y-2 overflow-hidden"
                                            >
                                                {NODE_TYPES.filter(n => n.category === category.id).map((nodeType) => (
                                                    <div
                                                        key={nodeType.type}
                                                        draggable
                                                        onDragStart={(e) => handleDragStart(e, nodeType.type)}
                                                        className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-[#1F2630] border-[#374151]' : 'bg-[#F6F7F9] border-[#D9DEE5]'} border cursor-grab hover:border-purple-500/50 transition-all group active:cursor-grabbing`}
                                                    >
                                                        <div
                                                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                                            style={{ backgroundColor: `${nodeType.color}20` }}
                                                        >
                                                            <nodeType.icon size={16} style={{ color: nodeType.color }} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className={`text-sm font-medium ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>{nodeType.label}</h4>
                                                            <p className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} truncate`}>{nodeType.description}</p>
                                                        </div>
                                                        <GripVertical size={14} className={`${isDark ? 'text-[#4B5563]' : 'text-[#9CA3AF]'} opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0`} />
                                                    </div>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Canvas Area */}
            <div className="flex-1 flex flex-col">
                {/* Toolbar */}
                <div className={`px-6 py-4 border-b ${isDark ? 'border-[#1F2630] bg-[#12161C]/80' : 'border-[#D9DEE5] bg-white/80'} backdrop-blur-sm flex items-center gap-4`}>
                    <button
                        onClick={() => setShowNodePalette(!showNodePalette)}
                        className={`p-2 rounded-lg transition-all ${showNodePalette
                            ? 'bg-purple-500/20 text-purple-400'
                            : isDark ? 'bg-[#1F2630] text-[#7D8590] hover:text-[#E6E8EB]' : 'bg-[#F6F7F9] text-[#6B7280] hover:text-[#0E1116]'
                            }`}
                    >
                        <GitBranch size={18} />
                    </button>

                    <div className={`h-6 w-px ${isDark ? 'bg-[#374151]' : 'bg-[#D9DEE5]'}`} />

                    <input
                        type="text"
                        value={flowName}
                        onChange={(e) => setFlowName(e.target.value)}
                        className={`bg-transparent border-none text-lg font-semibold ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'} focus:outline-none`}
                    />

                    <div className="flex-1" />

                    <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                        <CircleDot size={14} className="text-green-400" />
                        {nodes.length} nodes · {edges.length} connections
                    </div>

                    <div className={`h-6 w-px ${isDark ? 'bg-[#374151]' : 'bg-[#D9DEE5]'}`} />

                    <button
                        onClick={() => setShowTemplateModal(true)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${isDark ? 'bg-[#1F2630] text-[#A9AFB8] hover:text-[#E6E8EB]' : 'bg-[#F6F7F9] text-[#4B5563] hover:text-[#0E1116]'} transition-all text-sm`}
                    >
                        <Copy size={14} />
                        Templates
                    </button>

                    <button
                        onClick={handleSaveFlow}
                        disabled={isSaving}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-sm ${saveSuccess
                            ? 'bg-green-500/20 text-green-400'
                            : isDark ? 'bg-[#1F2630] text-[#A9AFB8] hover:text-[#E6E8EB]' : 'bg-[#F6F7F9] text-[#4B5563] hover:text-[#0E1116]'
                            }`}
                    >
                        {isSaving ? <Loader2 size={14} className="animate-spin" /> : saveSuccess ? <CheckCircle2 size={14} /> : <Save size={14} />}
                        {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save'}
                    </button>

                    {selectedNode && (
                        <button
                            onClick={() => deleteNode(selectedNode)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all text-sm"
                        >
                            <Trash2 size={14} />
                            Delete
                        </button>
                    )}

                    <button
                        onClick={isRunning ? handleStopFlow : handleRunFlow}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-medium text-sm transition-all ${isRunning
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90'
                            }`}
                    >
                        {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                        {isRunning ? 'Stop' : 'Run'}
                    </button>
                </div>

                {/* React Flow Canvas */}
                <div className="flex-1 relative" onDrop={onDrop} onDragOver={onDragOver}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeClick={onNodeClick}
                        nodeTypes={nodeTypes}
                        fitView
                        snapToGrid
                        snapGrid={[16, 16]}
                        defaultEdgeOptions={{
                            animated: true,
                            type: 'smoothstep',
                            style: { stroke: '#8b5cf6', strokeWidth: 2 }
                        }}
                        style={{ background: isDark ? '#0B0D10' : '#F6F7F9' }}
                    >
                        <Background color={isDark ? '#374151' : '#D9DEE5'} gap={24} size={1} />
                        <Controls
                            className={`${isDark ? '!bg-[#1F2630] !border-[#374151]' : '!bg-white !border-[#D9DEE5]'} !rounded-xl !shadow-lg`}
                            style={{ button: { backgroundColor: isDark ? '#1F2630' : '#ffffff', borderColor: isDark ? '#374151' : '#D9DEE5' } }}
                        />
                        <MiniMap
                            nodeColor={(n) => {
                                const nodeType = NODE_TYPES.find(t => t.type === n.data?.nodeType);
                                return nodeType?.color || '#8b5cf6';
                            }}
                            maskColor={isDark ? 'rgba(11, 13, 16, 0.8)' : 'rgba(246, 247, 249, 0.8)'}
                            className={`${isDark ? '!bg-[#1F2630] !border-[#374151]' : '!bg-white !border-[#D9DEE5]'} !rounded-xl`}
                        />
                    </ReactFlow>

                    {/* Templates Overlay */}
                    <AnimatePresence>
                        {showTemplates && nodes.length === 0 && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className={`absolute inset-0 flex items-center justify-center ${isDark ? 'bg-[#0B0D10]/80' : 'bg-[#F6F7F9]/80'} backdrop-blur-sm z-20`}
                            >
                                <div className="text-center max-w-2xl px-8">
                                    <h2 className={`text-2xl font-bold ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'} mb-2`}>Create Your Agent Flow</h2>
                                    <p className={`${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} mb-8`}>Choose a template to get started or create a custom flow</p>

                                    <div className="grid grid-cols-2 gap-4">
                                        {TEMPLATES.map((template) => (
                                            <button
                                                key={template.id}
                                                onClick={() => loadTemplate(template.id)}
                                                className={`p-6 rounded-2xl ${isDark ? 'bg-[#1F2630] border-[#374151]' : 'bg-white border-[#D9DEE5]'} border hover:border-purple-500/50 transition-all text-left group`}
                                            >
                                                <h3 className={`text-lg font-semibold ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'} group-hover:text-purple-400 transition-colors`}>{template.name}</h3>
                                                <p className={`text-sm ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} mt-1`}>{template.description}</p>
                                                <p className={`text-xs ${isDark ? 'text-[#4B5563]' : 'text-[#9CA3AF]'} mt-2`}>{template.nodes} nodes</p>
                                            </button>
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => setShowTemplates(false)}
                                        className={`mt-6 text-sm ${isDark ? 'text-[#7D8590] hover:text-[#E6E8EB]' : 'text-[#6B7280] hover:text-[#0E1116]'} transition-colors`}
                                    >
                                        Skip and start from scratch
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Empty State */}
                    {nodes.length === 0 && !showTemplates && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                            <div className="text-center">
                                <GitBranch size={48} className={`${isDark ? 'text-[#374151]' : 'text-[#D9DEE5]'} mx-auto mb-4`} />
                                <p className={isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}>Drag nodes from the left panel to build your flow</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Sidebar - Node Config */}
            <AnimatePresence>
                {selectedNode && selectedNodeData && (
                    <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 320, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        className={`h-full ${isDark ? 'bg-[#12161C] border-[#1F2630]' : 'bg-white border-[#D9DEE5]'} border-l flex flex-col overflow-hidden`}
                    >
                        <div className={`p-4 border-b ${isDark ? 'border-[#1F2630]' : 'border-[#D9DEE5]'} flex items-center justify-between`}>
                            <h3 className={`text-sm font-semibold ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>Node Configuration</h3>
                            <button
                                onClick={() => setSelectedNode(null)}
                                className={`p-1 ${isDark ? 'hover:bg-[#1F2630] text-[#7D8590] hover:text-[#E6E8EB]' : 'hover:bg-[#F6F7F9] text-[#6B7280] hover:text-[#0E1116]'} rounded transition-all`}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="flex-1 p-4 overflow-y-auto">
                            {(() => {
                                const nodeType = NODE_TYPES.find(t => t.type === selectedNodeData.data?.nodeType);

                                return (
                                    <div className="space-y-4">
                                        <div>
                                            <label className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} block mb-1`}>Node Name</label>
                                            <input
                                                type="text"
                                                value={selectedNodeData.data?.label || ''}
                                                onChange={(e) => setNodes(prev => prev.map(n =>
                                                    n.id === selectedNode ? { ...n, data: { ...n.data, label: e.target.value } } : n
                                                ))}
                                                className={`w-full ${isDark ? 'bg-[#1F2630] border-[#374151] text-[#E6E8EB]' : 'bg-[#F6F7F9] border-[#D9DEE5] text-[#0E1116]'} border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500`}
                                            />
                                        </div>

                                        <div>
                                            <label className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} block mb-1`}>Type</label>
                                            <div className={`flex items-center gap-2 px-3 py-2 ${isDark ? 'bg-[#1F2630] border-[#374151]' : 'bg-[#F6F7F9] border-[#D9DEE5]'} rounded-lg border`}>
                                                {nodeType && <nodeType.icon size={16} style={{ color: nodeType.color }} />}
                                                <span className={`text-sm ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>{nodeType?.label}</span>
                                            </div>
                                        </div>

                                        {selectedNodeData.data?.nodeType === 'llm' && (
                                            <>
                                                <div>
                                                    <label className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} block mb-1`}>Model</label>
                                                    <select className={`w-full ${isDark ? 'bg-[#1F2630] border-[#374151] text-[#E6E8EB]' : 'bg-[#F6F7F9] border-[#D9DEE5] text-[#0E1116]'} border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500`}>
                                                        <option>gpt-4-turbo</option>
                                                        <option>gpt-4</option>
                                                        <option>gpt-3.5-turbo</option>
                                                        <option>claude-3-opus</option>
                                                        <option>claude-3-sonnet</option>
                                                        <option>gemini-pro</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} block mb-1`}>Temperature</label>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="2"
                                                        step="0.1"
                                                        defaultValue="0.7"
                                                        className="w-full"
                                                    />
                                                </div>
                                            </>
                                        )}

                                        {selectedNodeData.data?.nodeType === 'prompt' && (
                                            <div>
                                                <label className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} block mb-1`}>Prompt Template</label>
                                                <textarea
                                                    placeholder="Enter your prompt template..."
                                                    className={`w-full ${isDark ? 'bg-[#1F2630] border-[#374151] text-[#E6E8EB]' : 'bg-[#F6F7F9] border-[#D9DEE5] text-[#0E1116]'} border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 h-32 resize-none`}
                                                />
                                            </div>
                                        )}

                                        {selectedNodeData.data?.nodeType === 'memory' && (
                                            <div>
                                                <label className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} block mb-1`}>Memory Type</label>
                                                <select className={`w-full ${isDark ? 'bg-[#1F2630] border-[#374151] text-[#E6E8EB]' : 'bg-[#F6F7F9] border-[#D9DEE5] text-[#0E1116]'} border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500`}>
                                                    <option>Buffer Memory</option>
                                                    <option>Summary Memory</option>
                                                    <option>Vector Store Memory</option>
                                                    <option>Token Buffer Memory</option>
                                                </select>
                                            </div>
                                        )}

                                        {selectedNodeData.data?.nodeType === 'tool' && (
                                            <div>
                                                <label className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} block mb-1`}>Tool Type</label>
                                                <select className={`w-full ${isDark ? 'bg-[#1F2630] border-[#374151] text-[#E6E8EB]' : 'bg-[#F6F7F9] border-[#D9DEE5] text-[#0E1116]'} border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500`}>
                                                    <option>Web Search</option>
                                                    <option>Calculator</option>
                                                    <option>Weather API</option>
                                                    <option>Database Query</option>
                                                    <option>Custom API</option>
                                                </select>
                                            </div>
                                        )}

                                        {selectedNodeData.data?.nodeType === 'http' && (
                                            <>
                                                <div>
                                                    <label className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} block mb-1`}>Method</label>
                                                    <select className={`w-full ${isDark ? 'bg-[#1F2630] border-[#374151] text-[#E6E8EB]' : 'bg-[#F6F7F9] border-[#D9DEE5] text-[#0E1116]'} border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500`}>
                                                        <option>GET</option>
                                                        <option>POST</option>
                                                        <option>PUT</option>
                                                        <option>DELETE</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} block mb-1`}>URL</label>
                                                    <input
                                                        type="text"
                                                        placeholder="https://api.example.com/endpoint"
                                                        className={`w-full ${isDark ? 'bg-[#1F2630] border-[#374151] text-[#E6E8EB]' : 'bg-[#F6F7F9] border-[#D9DEE5] text-[#0E1116]'} border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500`}
                                                    />
                                                </div>
                                            </>
                                        )}

                                        {selectedNodeData.data?.nodeType === 'code' && (
                                            <div>
                                                <label className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} block mb-1`}>Custom Code</label>
                                                <textarea
                                                    placeholder="// Write your custom code here..."
                                                    className={`w-full ${isDark ? 'bg-[#1F2630] border-[#374151] text-[#E6E8EB]' : 'bg-[#F6F7F9] border-[#D9DEE5] text-[#0E1116]'} border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 h-40 resize-none font-mono`}
                                                />
                                            </div>
                                        )}

                                        {selectedNodeData.data?.nodeType === 'note' && (
                                            <div>
                                                <label className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} block mb-1`}>Note Text</label>
                                                <textarea
                                                    value={selectedNodeData.data?.config?.text || ''}
                                                    onChange={(e) => setNodes(prev => prev.map(n =>
                                                        n.id === selectedNode ? { ...n, data: { ...n.data, config: { ...n.data.config, text: e.target.value } } } : n
                                                    ))}
                                                    placeholder="Enter sticky note instructions..."
                                                    className={`w-full ${isDark ? 'bg-[#1F2630] border-[#374151] text-[#E6E8EB]' : 'bg-[#F6F7F9] border-[#D9DEE5] text-[#0E1116]'} border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 h-32 resize-none`}
                                                />
                                            </div>
                                        )}

                                        {selectedNodeData.data?.nodeType === 'condition' && (
                                            <div>
                                                <label className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} block mb-1`}>Condition Expression</label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g., input.length > 100"
                                                    className={`w-full ${isDark ? 'bg-[#1F2630] border-[#374151] text-[#E6E8EB]' : 'bg-[#F6F7F9] border-[#D9DEE5] text-[#0E1116]'} border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500`}
                                                />
                                                <p className={`text-xs ${isDark ? 'text-[#4B5563]' : 'text-[#9CA3AF]'} mt-2`}>
                                                    Green output = true, Red output = false
                                                </p>
                                            </div>
                                        )}

                                        {selectedNodeData.data?.nodeType === 'retriever' && (
                                            <>
                                                <div>
                                                    <label className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} block mb-1`}>Vector Store</label>
                                                    <select className={`w-full ${isDark ? 'bg-[#1F2630] border-[#374151] text-[#E6E8EB]' : 'bg-[#F6F7F9] border-[#D9DEE5] text-[#0E1116]'} border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500`}>
                                                        <option>Pinecone</option>
                                                        <option>Chroma</option>
                                                        <option>Weaviate</option>
                                                        <option>Qdrant</option>
                                                        <option>FAISS</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} block mb-1`}>Top K Results</label>
                                                    <input
                                                        type="number"
                                                        defaultValue={4}
                                                        min={1}
                                                        max={20}
                                                        className={`w-full ${isDark ? 'bg-[#1F2630] border-[#374151] text-[#E6E8EB]' : 'bg-[#F6F7F9] border-[#D9DEE5] text-[#0E1116]'} border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500`}
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Templates Modal */}
            <AnimatePresence>
                {showTemplateModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
                        onClick={() => setShowTemplateModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className={`${isDark ? 'bg-[#12161C] border-[#1F2630]' : 'bg-white border-[#D9DEE5]'} border rounded-2xl p-6 max-w-2xl w-full mx-4 shadow-2xl`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className={`text-xl font-bold ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>Choose a Template</h2>
                                <button
                                    onClick={() => setShowTemplateModal(false)}
                                    className={`p-2 ${isDark ? 'hover:bg-[#1F2630] text-[#7D8590] hover:text-[#E6E8EB]' : 'hover:bg-[#F6F7F9] text-[#6B7280] hover:text-[#0E1116]'} rounded-lg transition-all`}
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {TEMPLATES.map((template) => (
                                    <button
                                        key={template.id}
                                        onClick={() => { loadTemplate(template.id); setShowTemplateModal(false); }}
                                        className={`p-5 rounded-xl ${isDark ? 'bg-[#1F2630] border-[#374151]' : 'bg-[#F6F7F9] border-[#D9DEE5]'} border hover:border-purple-500/50 transition-all text-left group`}
                                    >
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                                                <GitBranch size={18} className="text-purple-400" />
                                            </div>
                                            <div>
                                                <h3 className={`font-semibold ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'} group-hover:text-purple-400 transition-colors`}>{template.name}</h3>
                                                <p className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>{template.nodes} nodes</p>
                                            </div>
                                        </div>
                                        <p className={`text-sm ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>{template.description}</p>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Run Status Panel */}
            <AnimatePresence>
                {(runStatus || runLog.length > 0) && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className={`fixed bottom-6 right-6 w-80 ${isDark ? 'bg-[#12161C] border-[#1F2630]' : 'bg-white border-[#D9DEE5]'} border rounded-2xl shadow-2xl overflow-hidden z-40`}
                    >
                        <div className={`p-4 border-b ${isDark ? 'border-[#1F2630]' : 'border-[#D9DEE5]'} flex items-center justify-between`}>
                            <div className="flex items-center gap-2">
                                {runStatus === 'running' && <Loader2 size={16} className="text-purple-400 animate-spin" />}
                                {runStatus === 'success' && <CheckCircle2 size={16} className="text-green-400" />}
                                {runStatus === 'error' && <AlertCircle size={16} className="text-red-400" />}
                                <span className={`font-medium ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                                    {runStatus === 'running' ? 'Running Flow...' : runStatus === 'success' ? 'Flow Completed' : 'Flow Error'}
                                </span>
                            </div>
                            <button
                                onClick={() => { setRunStatus(null); setRunLog([]); }}
                                className={`p-1 ${isDark ? 'hover:bg-[#1F2630] text-[#7D8590] hover:text-[#E6E8EB]' : 'hover:bg-[#F6F7F9] text-[#6B7280] hover:text-[#0E1116]'} rounded`}
                            >
                                <X size={14} />
                            </button>
                        </div>

                        {runStatus === 'running' && (
                            <div className="px-4 py-2">
                                <div className={`h-2 ${isDark ? 'bg-[#1F2630]' : 'bg-[#F6F7F9]'} rounded-full overflow-hidden`}>
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${runProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="p-4 max-h-48 overflow-y-auto">
                            {runLog.map((log, i) => (
                                <p key={i} className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} py-1 font-mono`}>{log}</p>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Flow;
