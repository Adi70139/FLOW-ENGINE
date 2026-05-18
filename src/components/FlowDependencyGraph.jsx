import { useState, useEffect } from "react";
import { api } from "../utils/api";
import styles from "./FlowDependencyGraph.module.css";

function FlowDependencyGraph({ flowId }) {
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [hoveredEdge, setHoveredEdge] = useState(null);

  useEffect(() => {
    if (!flowId) return;
    setLoading(true);
    setError("");
    api.getDependencyGraph(flowId)
      .then(data => {
        setGraphData(data);
      })
      .catch(err => {
        console.error("Failed to fetch dependency graph:", err);
        setError("Failed to load dependency graph.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [flowId]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <span>Generating animated dependency graph...</span>
      </div>
    );
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
    return <div className={styles.empty}>No dependency data found. Define variable extractions and placeholders in your steps!</div>;
  }

  const { nodes = [], edges = [] } = graphData;

  // Lay out nodes vertically
  const nodeWidth = 220;
  const nodeHeight = 70;
  const centerX = 150;
  const startY = 50;
  const spacingY = 140;

  const nodePositions = {};
  nodes.forEach((node, index) => {
    nodePositions[node.stepId] = {
      x: centerX,
      y: startY + index * spacingY,
      index
    };
  });

  const svgWidth = 300;
  const svgHeight = startY + nodes.length * spacingY - 50;

  function getMethodColor(method) {
    const m = method?.toUpperCase();
    if (m === "GET") return "var(--method-get)";
    if (m === "POST") return "var(--method-post)";
    if (m === "PUT") return "var(--method-put)";
    if (m === "DELETE") return "var(--method-delete)";
    return "var(--text-muted)";
  }

  return (
    <div className={styles.container}>
      <p className={styles.description}>
        Animated visualization of data flowing between steps via <code>{`{placeholders}`}</code>. Hover over elements to inspect details.
      </p>

      <div className={styles.graphWrapper}>
        <svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} className={styles.svg}>
          <defs>
            {/* Arrow Marker */}
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--accent)" />
            </marker>
            {/* Shadow Filter */}
            <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.06" />
            </filter>
          </defs>

          {/* ── Draw Edges (Connector Lines) ── */}
          {edges.map((edge, idx) => {
            const fromPos = nodePositions[edge.fromStepId];
            const toPos = nodePositions[edge.toStepId];
            if (!fromPos || !toPos) return null;

            // Determine if edge is jumping a step (e.g. Step 1 to Step 3)
            const indexDiff = Math.abs(toPos.index - fromPos.index);
            const isJumping = indexDiff > 1;

            // Anchor points
            const startX = fromPos.x;
            const startY = fromPos.y + nodeHeight / 2;
            const endX = toPos.x;
            const endY = toPos.y - nodeHeight / 2;

            // Draw curved paths for jumping edges to prevent overlapping
            let dPath = "";
            if (isJumping) {
              const controlX = startX - 80; // sweep curve out to the left
              const midY = (startY + endY) / 2;
              dPath = `M ${startX} ${startY} C ${controlX} ${startY + 20}, ${controlX} ${endY - 20}, ${endX} ${endY}`;
            } else {
              // Direct vertical edge with subtle curve
              dPath = `M ${startX} ${startY} C ${startX} ${startY + 30}, ${endX} ${endY - 30}, ${endX} ${endY}`;
            }

            const isHovered = hoveredEdge === idx || hoveredNodeId === edge.fromStepId || hoveredNodeId === edge.toStepId;

            return (
              <g 
                key={idx} 
                onMouseEnter={() => setHoveredEdge(idx)}
                onMouseLeave={() => setHoveredEdge(null)}
                className={styles.edgeGroup}
              >
                {/* Thick invisible interactive path for easier hover */}
                <path
                  d={dPath}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={15}
                  cursor="pointer"
                />

                {/* Base Edge path */}
                <path
                  d={dPath}
                  fill="none"
                  stroke={isHovered ? "var(--accent)" : "var(--border)"}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  markerEnd="url(#arrow)"
                  className={styles.edgeBase}
                />

                {/* Animated energy dash path flowing downwards */}
                <path
                  d={dPath}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  className={styles.edgeAnimated}
                />

                {/* Midpoint Label Container */}
                {edge.keys && edge.keys.length > 0 && (
                  <foreignObject
                    x={isJumping ? startX - 90 : startX - 45}
                    y={(startY + endY) / 2 - 10}
                    width={90}
                    height={20}
                  >
                    <div 
                      className={`${styles.edgeKeyPill} ${isHovered ? styles.edgeKeyPillActive : ""}`}
                      title={`Flowing variable: ${edge.keys.join(", ")}`}
                    >
                      🔑 {edge.keys.join(", ")}
                    </div>
                  </foreignObject>
                )}
              </g>
            );
          })}

          {/* ── Draw Step Nodes ── */}
          {nodes.map((node) => {
            const pos = nodePositions[node.stepId];
            if (!pos) return null;

            const isHovered = hoveredNodeId === node.stepId;
            const methodColor = getMethodColor(node.method);

            return (
              <g
                key={node.stepId}
                transform={`translate(${pos.x - nodeWidth / 2}, ${pos.y - nodeHeight / 2})`}
                onMouseEnter={() => setHoveredNodeId(node.stepId)}
                onMouseLeave={() => setHoveredNodeId(null)}
                className={styles.nodeGroup}
              >
                {/* Node Box */}
                <rect
                  width={nodeWidth}
                  height={nodeHeight}
                  rx={12}
                  ry={12}
                  fill="white"
                  stroke={isHovered ? "var(--accent)" : "var(--border)"}
                  strokeWidth={isHovered ? 2 : 1}
                  filter="url(#shadow)"
                  className={styles.nodeBox}
                />

                {/* Node Contents */}
                <g transform="translate(14, 20)">
                  {/* Method Badge */}
                  <text
                    fill={methodColor}
                    fontSize="9px"
                    fontWeight="800"
                    fontFamily="inherit"
                    textAnchor="start"
                  >
                    {node.method?.toUpperCase()}
                  </text>

                  {/* Step Title */}
                  <text
                    x={42}
                    y={0}
                    fill="var(--text-primary)"
                    fontSize="12px"
                    fontWeight="700"
                    fontFamily="inherit"
                  >
                    {node.stepName.length > 20 ? node.stepName.slice(0, 20) + "..." : node.stepName}
                  </text>

                  {/* Input / Output metadata details */}
                  <g transform="translate(0, 24)">
                    {/* Inputs */}
                    {node.usedPlaceholders && node.usedPlaceholders.length > 0 && (
                      <g>
                        <text fill="var(--text-muted)" fontSize="9px" fontWeight="600">IN:</text>
                        <text fill="#3b82f6" fontSize="9px" fontWeight="700" x={20}>
                          {node.usedPlaceholders.slice(0, 2).join(", ")}
                          {node.usedPlaceholders.length > 2 && "..."}
                        </text>
                      </g>
                    )}
                    {/* Outputs */}
                    {node.producedKeys && node.producedKeys.length > 0 && (
                      <g transform={`translate(${node.usedPlaceholders?.length ? 100 : 0}, 0)`}>
                        <text fill="var(--text-muted)" fontSize="9px" fontWeight="600">OUT:</text>
                        <text fill="var(--status-success)" fontSize="9px" fontWeight="700" x={26}>
                          {node.producedKeys.slice(0, 2).join(", ")}
                          {node.producedKeys.length > 2 && "..."}
                        </text>
                      </g>
                    )}
                  </g>
                </g>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default FlowDependencyGraph;
