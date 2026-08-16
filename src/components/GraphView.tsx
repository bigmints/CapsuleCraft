import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { CapsuleNode, GraphNode, GraphEdge, VaultGraphState } from '../types';
import {
  Network,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Sliders,
  Filter,
  Sparkles,
  ArrowRight,
  FileText,
  Tag,
} from 'lucide-react';

interface Props {
  graphState: VaultGraphState;
  selectedMessageId: string | null;
  onSelectNode: (messageId: string) => void;
  onOpenInCanvas: (messageId: string) => void;
}

export const GraphView: React.FC<Props> = ({
  graphState,
  selectedMessageId,
  onSelectNode,
  onOpenInCanvas,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [tagFilter, setTagFilter] = useState<string>('all');
  const [chargeStrength, setChargeStrength] = useState<number>(-280);
  const [linkDistance, setLinkDistance] = useState<number>(100);
  const [showControls, setShowControls] = useState(false);

  const allTags = Array.from(graphState.tagIndex.keys());

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous

    // Prepare filtered data
    let rawNodes = graphState.graphNodes.map((d) => ({ ...d }));
    let rawEdges = graphState.graphEdges.map((d) => ({ ...d }));

    if (tagFilter !== 'all') {
      const allowedIds = new Set(graphState.tagIndex.get(tagFilter) || []);
      rawNodes = rawNodes.filter((n) => allowedIds.has(n.id));
      rawEdges = rawEdges.filter((e) => allowedIds.has(e.source as string) && allowedIds.has(e.target as string));
    }

    if (rawNodes.length === 0) return;

    // Arrow markers for directed edges
    const defs = svg.append('defs');

    // Arrow for In-Reply-To
    defs
      .append('marker')
      .attr('id', 'arrow-in-reply-to')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 22)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#38bdf8');

    // Arrow for References
    defs
      .append('marker')
      .attr('id', 'arrow-references')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 22)
      .attr('refY', 0)
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#a855f7');

    const g = svg.append('g').attr('class', 'graph-root');

    // Zoom behavior
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoomBehavior);

    // D3 Force simulation
    const simulation = d3
      .forceSimulation<GraphNode>(rawNodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, any>(rawEdges)
          .id((d) => d.id)
          .distance(linkDistance)
      )
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d: any) => 30 + (d.degree || 1) * 4));

    // Render Edges
    const linkGroup = g.append('g').attr('class', 'links');
    const links = linkGroup
      .selectAll<SVGLineElement, GraphEdge>('line')
      .data(rawEdges)
      .enter()
      .append('line')
      .attr('stroke', (d: GraphEdge) => (d.type === 'in_reply_to' ? '#38bdf8' : '#a855f7'))
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d: GraphEdge) => (d.type === 'in_reply_to' ? 2 : 1.5))
      .attr('stroke-dasharray', (d: GraphEdge) => (d.type === 'references' ? '4 3' : 'none'))
      .attr('marker-end', (d: GraphEdge) => (d.type === 'in_reply_to' ? 'url(#arrow-in-reply-to)' : 'url(#arrow-references)'));

    // Render Nodes
    const nodeGroup = g.append('g').attr('class', 'nodes');
    const nodes = nodeGroup
      .selectAll<SVGGElement, GraphNode>('g')
      .data(rawNodes)
      .enter()
      .append('g')
      .attr('class', 'node-item')
      .attr('cursor', 'pointer')
      .on('click', (event: MouseEvent, d: GraphNode) => {
        event.stopPropagation();
        onSelectNode(d.id);
      })
      .call(
        d3
          .drag<any, GraphNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Node outer halo for selected
    nodes
      .append('circle')
      .attr('r', (d: GraphNode) => 18 + (d.degree || 0) * 3)
      .attr('fill', (d: GraphNode) => (d.id === selectedMessageId ? 'rgba(56, 189, 248, 0.25)' : 'rgba(30, 41, 59, 0.6)'))
      .attr('stroke', (d: GraphNode) => {
        if (d.id === selectedMessageId) return '#38bdf8';
        if (d.tags.includes('#finance')) return '#10b981';
        if (d.tags.includes('#ai-strategy')) return '#a855f7';
        if (d.tags.includes('#architecture')) return '#38bdf8';
        return '#64748b';
      })
      .attr('stroke-width', (d: GraphNode) => (d.id === selectedMessageId ? 3 : 1.5))
      .attr('class', 'transition-all duration-200');

    // Inner icon / core circle
    nodes
      .append('circle')
      .attr('r', 8)
      .attr('fill', (d: GraphNode) => {
        if (d.status === 'Synthesis') return '#a855f7';
        if (d.tags.includes('#finance')) return '#10b981';
        if (d.tags.includes('#ai-strategy')) return '#38bdf8';
        return '#475569';
      });

    // Node Label
    nodes
      .append('text')
      .text((d: GraphNode) => d.subject.length > 22 ? d.subject.substring(0, 20) + '...' : d.subject)
      .attr('x', 0)
      .attr('y', (d: GraphNode) => 28 + (d.degree || 0) * 3)
      .attr('text-anchor', 'middle')
      .attr('fill', '#cbd5e1')
      .attr('font-size', '11px')
      .attr('font-family', '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif')
      .attr('font-weight', (d: GraphNode) => (d.id === selectedMessageId ? '600' : '400'))
      .attr('paint-order', 'stroke')
      .attr('stroke', '#090d16')
      .attr('stroke-width', '3px');

    // Simulation tick
    simulation.on('tick', () => {
      links
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      nodes.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [graphState, selectedMessageId, tagFilter, chargeStrength, linkDistance]);

  const selectedNodeData = selectedMessageId ? graphState.nodes.get(selectedMessageId) : null;

  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-950 overflow-hidden flex flex-col">
      {/* Top Overlay Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 bg-slate-900/90 p-2 rounded-xl border border-slate-800 backdrop-blur-md shadow-xl">
        <div className="flex items-center gap-2 px-2 border-r border-slate-800">
          <Network className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            In-Memory Directed DAG
          </span>
        </div>

        {/* Tag Filter */}
        <div className="flex items-center gap-1.5 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="bg-slate-800 text-slate-200 border border-slate-700 rounded px-2 py-1 outline-none text-xs"
          >
            <option value="all">Все теги ({graphState.graphNodes.length})</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag} ({graphState.tagIndex.get(tag)?.length || 0})
              </option>
            ))}
          </select>
        </div>

        {/* Physics toggle */}
        <button
          type="button"
          onClick={() => setShowControls(!showControls)}
          className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors ${showControls ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'}`}
          title="Adjust Physics Forces"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Физика</span>
        </button>

        {/* Telemetry badge */}
        <div className="hidden md:flex items-center gap-1.5 px-2 text-[11px] font-mono text-emerald-400 bg-emerald-950/50 py-0.5 rounded border border-emerald-800/40">
          <Sparkles className="w-3 h-3" />
          <span>RAM Index: {graphState.graphNodes.length} нод / {graphState.graphEdges.length} связей</span>
        </div>
      </div>

      {/* Physics Sliders Drawer */}
      {showControls && (
        <div className="absolute top-18 left-4 z-10 w-72 bg-slate-900/95 p-3 rounded-xl border border-slate-800 backdrop-blur-md shadow-2xl space-y-3 text-xs text-slate-300 animate-in fade-in slide-in-from-top-2">
          <div className="font-semibold text-slate-200 border-b border-slate-800 pb-1 flex justify-between">
            <span>Параметры графа (D3 Physics)</span>
            <button onClick={() => setShowControls(false)} className="text-slate-500 hover:text-slate-300">✕</button>
          </div>
          <div>
            <div className="flex justify-between mb-1 text-[11px]">
              <span className="text-slate-400">Сила отталкивания (Charge):</span>
              <span className="font-mono text-sky-400">{chargeStrength}</span>
            </div>
            <input
              type="range"
              min="-600"
              max="-50"
              step="10"
              value={chargeStrength}
              onChange={(e) => setChargeStrength(Number(e.target.value))}
              className="w-full accent-sky-400"
            />
          </div>
          <div>
            <div className="flex justify-between mb-1 text-[11px]">
              <span className="text-slate-400">Длина связей (Link Distance):</span>
              <span className="font-mono text-sky-400">{linkDistance}px</span>
            </div>
            <input
              type="range"
              min="40"
              max="250"
              step="10"
              value={linkDistance}
              onChange={(e) => setLinkDistance(Number(e.target.value))}
              className="w-full accent-sky-400"
            />
          </div>
        </div>
      )}

      {/* Legend & Guide */}
      <div className="absolute bottom-4 left-4 z-10 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 backdrop-blur-md text-[11px] font-mono text-slate-400 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="w-4 h-0.5 bg-sky-400 inline-block" />
          <span className="text-sky-300">In-Reply-To (Диалог)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-0.5 border-b border-dashed border-purple-400 inline-block" />
          <span className="text-purple-300">References (Ассоциация)</span>
        </div>
      </div>

      {/* Selected Node Inspector Drawer */}
      {selectedNodeData && (
        <div className="absolute bottom-4 right-4 z-10 w-80 sm:w-96 bg-slate-900/95 p-4 rounded-xl border border-sky-500/40 backdrop-blur-md shadow-2xl text-xs space-y-3 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2">
            <div>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">
                {selectedNodeData.status}
              </span>
              <h4 className="font-bold text-sm text-slate-100 mt-1 leading-snug">
                {selectedNodeData.subject}
              </h4>
            </div>
            <button
              onClick={() => onSelectNode('')}
              className="text-slate-500 hover:text-slate-300 p-1"
            >
              ✕
            </button>
          </div>

          <div className="space-y-1 text-slate-400 font-mono text-[11px]">
            <div><span className="text-slate-600">From:</span> {selectedNodeData.from}</div>
            <div><span className="text-slate-600">Date:</span> {new Date(selectedNodeData.timestamp).toLocaleDateString()}</div>
            {selectedNodeData.inReplyTo && (
              <div className="truncate text-sky-400">
                <span className="text-slate-600">Reply to:</span> {selectedNodeData.inReplyTo}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1">
            {selectedNodeData.tags.map((t) => (
              <span key={t} className="px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 text-[10px] font-mono">
                {t}
              </span>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              {selectedNodeData.blocks.length} блоков • {selectedNodeData.attachments.length} вложений
            </span>
            <button
              type="button"
              onClick={() => onOpenInCanvas(selectedNodeData.messageId)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition-colors shadow"
            >
              <span>Открыть капсулу</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* SVG Canvas for D3 */}
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  );
};
