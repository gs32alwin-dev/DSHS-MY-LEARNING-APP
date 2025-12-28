
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { MindMapNode } from '../types';

interface MindMapViewerProps {
  data: MindMapNode;
}

const MindMapViewer: React.FC<MindMapViewerProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const width = 800;
    const height = 600;
    const margin = { top: 20, right: 120, bottom: 20, left: 120 };

    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [-margin.left, -margin.top, width, height])
      .append("g");

    const root = d3.hierarchy(data);
    const treeLayout = d3.tree<MindMapNode>().size([height - 40, width - 240]);
    treeLayout(root);

    // Links
    svg.append("g")
      .attr("fill", "none")
      .attr("stroke", "#94a3b8")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", 1.5)
      .selectAll("path")
      .data(root.links())
      .join("path")
      .attr("d", d3.linkHorizontal<any, any>()
        .x((d: any) => d.y)
        .y((d: any) => d.x));

    // Nodes
    const node = svg.append("g")
      .selectAll("g")
      .data(root.descendants())
      .join("g")
      .attr("transform", (d: any) => `translate(${d.y},${d.x})`);

    node.append("circle")
      .attr("fill", d => d.children ? "#3b82f6" : "#94a3b8")
      .attr("r", 6);

    node.append("text")
      .attr("dy", "0.31em")
      .attr("x", d => d.children ? -8 : 8)
      .attr("text-anchor", d => d.children ? "end" : "start")
      .text(d => d.data.name)
      .attr("class", "text-xs font-medium fill-slate-700")
      .clone(true).lower()
      .attr("stroke", "white")
      .attr("stroke-width", 3);

  }, [data]);

  return (
    <div className="w-full h-full flex items-center justify-center bg-white rounded-xl overflow-hidden shadow-inner border border-slate-100">
      <svg ref={svgRef} className="w-full h-full max-h-[600px]"></svg>
    </div>
  );
};

export default MindMapViewer;
