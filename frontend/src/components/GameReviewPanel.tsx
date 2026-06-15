import React, { useState } from "react";
import type { GameReviewStats, MoveClassification } from "../chess-logic/models";
import { classificationImagePaths } from "../chess-logic/models";
import { classificationMetadata } from "../constants/classificationMetadata";
import { Award, ChevronLeft, ChevronRight } from "lucide-react";
import { getOpeningName } from "../services/openings";

interface GameReviewPanelProps {
  reviewStats: GameReviewStats;
  currentMoveIndex: number; // current selected review move index (0-based)
  onSelectMove: (index: number) => void;
  onCloseReview: () => void;
  onExitToDashboard?: () => void;
  flipMode?: boolean;
  isActiveMatch?: boolean;
  analysisProgress?: { completed: number; total: number } | null;
}

export const GameReviewPanel: React.FC<GameReviewPanelProps> = ({
  reviewStats,
  currentMoveIndex,
  onSelectMove,
  onCloseReview,
  onExitToDashboard,
  flipMode = false,
  isActiveMatch = false,
  analysisProgress = null,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; index: number; evalScore: number } | null>(null);
  
  const { whiteAccuracy, blackAccuracy, whiteClassifications, blackClassifications, moveAnalyses, estimatedRatingWhite, estimatedRatingBlack } = reviewStats;

  // Calculate opening name up to the currently reviewed move
  const flatMovesPlayed = moveAnalyses.slice(0, currentMoveIndex + 1).map((m) => m?.playedMoveStr || "");
  const openingName = getOpeningName(flatMovesPlayed);

  // Build points for SVG evaluation chart
  const padding = 20;
  const width = 360;
  const height = 140;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Extract evaluations and map them
  const evalValues = moveAnalyses.map((m) => {
    return m.evalAfter;
  });

  // Include starting evaluation of 0.3 at index -1
  const allEvals = [0.3, ...evalValues];
  
  const minEval = -6;
  const maxEval = 6;

  const getCoordinates = (index: number, evalVal: number) => {
    const x = padding + (index / (allEvals.length - 1)) * chartWidth;
    
    // Normalize evalVal to [0, 1] relative to [minEval, maxEval]
    const clamped = Math.max(minEval, Math.min(maxEval, evalVal));
    const normalized = (clamped - minEval) / (maxEval - minEval);
    
    // SVG coordinates start at top left, so we invert Y
    const y = padding + (1 - normalized) * chartHeight;
    return { x, y };
  };

  const polylinePoints = allEvals.map((val, idx) => {
    const coords = getCoordinates(idx, val);
    return `${coords.x},${coords.y}`;
  }).join(" ");

  const midY = getCoordinates(0, 0.0).y;
  const showLeftWhite = !flipMode;

  return (
    <div className="game-review-panel glass-panel">
      {/* Review Header / Accuracies */}
      <div className="review-acc-container">
        {showLeftWhite ? (
          <>
            <div className="acc-column white-acc">
              <span className="acc-color-dot white" />
              <div className="acc-val-box">
                <span className="acc-title">White Accuracy</span>
                <span className="acc-percent">{whiteAccuracy}%</span>
              </div>
            </div>

            <div className="review-vs">vs</div>

            <div className="acc-column black-acc">
              <span className="acc-color-dot black" />
              <div className="acc-val-box">
                <span className="acc-title">Black Accuracy</span>
                <span className="acc-percent">{blackAccuracy}%</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="acc-column black-acc" style={{ justifyContent: "flex-start", textAlign: "left", flexDirection: "row" }}>
              <span className="acc-color-dot black" />
              <div className="acc-val-box">
                <span className="acc-title">Black Accuracy</span>
                <span className="acc-percent">{blackAccuracy}%</span>
              </div>
            </div>

            <div className="review-vs">vs</div>

            <div className="acc-column white-acc" style={{ justifyContent: "flex-end", textAlign: "right", flexDirection: "row-reverse" }}>
              <span className="acc-color-dot white" />
              <div className="acc-val-box">
                <span className="acc-title">White Accuracy</span>
                <span className="acc-percent">{whiteAccuracy}%</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Incremental progress indicator */}
      {analysisProgress && (
        <div className="incremental-progress-container" style={{ padding: "8px 12px", background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--glass-border)", borderRadius: "10px" }}>
          <div className="progress-bar-container" style={{ margin: 0, height: 6, background: "rgba(255, 255, 255, 0.1)", borderRadius: 3, overflow: "hidden" }}>
            <div
              className="progress-bar-fill"
              style={{
                height: "100%",
                background: "var(--accent-primary)",
                width: `${Math.min(100, Math.round((analysisProgress.completed / analysisProgress.total) * 100))}%`,
                transition: "width 0.3s ease"
              }}
            />
          </div>
          <span className="incremental-progress-text" style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, display: "block", textAlign: "left" }}>
            Engine analysis: {analysisProgress.completed} / {analysisProgress.total} evaluated
          </span>
        </div>
      )}

      {/* Predicted Rating Stats */}
      <div className="rating-estimates">
        <div className="rating-card flex-center">
          <Award size={18} className="text-indigo-400" />
          <div className="rating-content">
            <h4>Estimated Ratings</h4>
            <p>
              {showLeftWhite ? (
                <>White: <strong>{estimatedRatingWhite}</strong> | Black: <strong>{estimatedRatingBlack}</strong></>
              ) : (
                <>Black: <strong>{estimatedRatingBlack}</strong> | White: <strong>{estimatedRatingWhite}</strong></>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Opening Theory Badge */}
      {openingName && (
        <div className="review-opening-container">
          <span className="review-opening-label">Theory</span>
          <span className="review-opening-name">{openingName}</span>
        </div>
      )}

      {/* SVG Evaluation Line Graph */}
      <div className="eval-chart-wrapper">
        <h4 className="chart-title">Evaluation Chart</h4>
        <div className="chart-canvas-container" style={{ position: "relative" }}>
          {moveAnalyses.length === 0 ? (
            <div className="chart-skeleton-loader flex-center">
              <div className="skeleton-spinner"></div>
              <span style={{ fontSize: 12, marginTop: 8 }}>Analyzing game state...</span>
            </div>
          ) : (
            <svg viewBox={`0 0 ${width} ${height}`} className="eval-svg">
              {/* Grid Line: Neutral (0.0) */}
              <line 
                x1={padding} 
                y1={midY} 
                x2={width - padding} 
                y2={midY} 
                stroke="rgba(255, 255, 255, 0.1)" 
                strokeDasharray="4 3"
              />

              {/* Glowing path */}
              <polyline
                fill="none"
                stroke="var(--accent-primary)"
                strokeWidth="2.5"
                points={polylinePoints}
                className="chart-polyline"
              />

              {/* Interactive Circles */}
              {allEvals.map((val, idx) => {
                const coords = getCoordinates(idx, val);
                const isSelected = idx === currentMoveIndex + 1; // offset by 1 because index 0 is initial position
                const isMatePoint = idx > 0 && Math.abs(val) >= 50;
                return (
                  <g key={idx}>
                    {isMatePoint && (
                      <line
                        x1={coords.x}
                        y1={midY}
                        x2={coords.x}
                        y2={coords.y}
                        stroke="#ffd700"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                    )}
                    <circle
                      cx={coords.x}
                      cy={coords.y}
                      r={isSelected ? 6 : hoveredPoint?.index === idx ? 5 : 2}
                      fill={isSelected ? (isMatePoint ? "gold" : "var(--accent-secondary)") : (isMatePoint ? "gold" : "var(--text-primary)")}
                      stroke={isSelected ? "#ffffff" : (isMatePoint ? "#ffb700" : "var(--accent-primary)")}
                      strokeWidth={isSelected ? 2 : 1}
                      className="chart-point"
                      onMouseEnter={() => setHoveredPoint({ x: coords.x, y: coords.y, index: idx, evalScore: val })}
                      onMouseLeave={() => setHoveredPoint(null)}
                      onClick={() => {
                        onSelectMove(idx - 1);
                      }}
                    />
                    {isMatePoint && (
                      <text
                        x={coords.x}
                        y={val > 0 ? coords.y - 6 : coords.y + 11}
                        fill="gold"
                        fontSize="8"
                        fontWeight="bold"
                        textAnchor="middle"
                        style={{ pointerEvents: "none" }}
                      >
                        #{Math.round(100 - Math.abs(val))}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Tooltip on hover */}
              {hoveredPoint && (
                <g className="chart-tooltip">
                  <rect
                    x={Math.max(10, Math.min(width - 130, hoveredPoint.x - 60))}
                    y={hoveredPoint.y - 28}
                    width="120"
                    height="20"
                    rx="4"
                    fill="rgba(10, 15, 29, 0.95)"
                    stroke="var(--glass-border)"
                    strokeWidth="1"
                  />
                  <text
                    x={Math.max(10, Math.min(width - 130, hoveredPoint.x - 60)) + 60}
                    y={hoveredPoint.y - 14}
                    fill="white"
                    fontSize="9"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {hoveredPoint.index === 0 ? "Start" : (() => {
                      const isWhiteMove = hoveredPoint.index % 2 !== 0;
                      const moveNum = Math.ceil(hoveredPoint.index / 2);
                      const isMate = Math.abs(hoveredPoint.evalScore) >= 50;
                      const mateMoves = isMate ? (hoveredPoint.evalScore > 0 ? 100 - hoveredPoint.evalScore : -100 - hoveredPoint.evalScore) : 0;
                      const scoreText = isMate ? `#${Math.abs(mateMoves)}` : `${hoveredPoint.evalScore > 0 ? "+" : ""}${hoveredPoint.evalScore.toFixed(1)}`;
                      return `Move ${moveNum} (${isWhiteMove ? "White" : "Black"}): ${scoreText}`;
                    })()}
                  </text>
                </g>
              )}
            </svg>
          )}
        </div>
      </div>

      {/* Classifications Grid (Side-by-side) */}
      <div className="classifications-table">
        <div className="table-header">
          {showLeftWhite ? (
            <>
              <span>White</span>
              <span>Category</span>
              <span>Black</span>
            </>
          ) : (
            <>
              <span>Black</span>
              <span>Category</span>
              <span>White</span>
            </>
          )}
        </div>
        
        {(Object.keys(classificationMetadata) as MoveClassification[]).map((key) => {
          const meta = classificationMetadata[key];
          const wCount = whiteClassifications[key];
          const bCount = blackClassifications[key];
          
          if (wCount === 0 && bCount === 0) return null; // hide categories with zero occurrences for clean view

          return (
            <div key={key} className="table-row">
              {showLeftWhite ? (
                <>
                  <span className="count-col white-count">{wCount}</span>
                  <span className="category-col" style={{ color: meta.color }}>
                    <img src={classificationImagePaths[key]} alt={meta.label} className="cat-icon-img" />
                    <span className="cat-label">{meta.label}</span>
                  </span>
                  <span className="count-col black-count">{bCount}</span>
                </>
              ) : (
                <>
                  <span className="count-col black-count">{bCount}</span>
                  <span className="category-col" style={{ color: meta.color }}>
                    <img src={classificationImagePaths[key]} alt={meta.label} className="cat-icon-img" />
                    <span className="cat-label">{meta.label}</span>
                  </span>
                  <span className="count-col white-count">{wCount}</span>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Walkthrough Feedback Panel */}
      {moveAnalyses.length > 0 && (
        <div className="walkthrough-panel glass-panel">
          {currentMoveIndex === -1 ? (
            <>
              <div className="walkthrough-header">
                <h4>Starting Position</h4>
              </div>

              <p className="walkthrough-desc">
                Start of the match. No moves played yet. Use the Next button or click on the chart to review moves.
              </p>

              {/* Stepper Navigation */}
              <div className="walkthrough-controls">
                <button
                  className="stepper-btn"
                  disabled={true}
                  onClick={() => {}}
                >
                  <ChevronLeft size={16} />
                  <span>Prev</span>
                </button>
                <span className="stepper-pos">
                  0 / {moveAnalyses.length}
                </span>
                <button
                  className="stepper-btn"
                  disabled={moveAnalyses.length === 0}
                  onClick={() => onSelectMove(0)}
                >
                  <span>Next</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="walkthrough-header">
                <h4>Move {Math.floor((currentMoveIndex + 2) / 2)} Review</h4>
                <div className="walkthrough-badge-wrap" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {moveAnalyses[currentMoveIndex] && (
                    <img 
                      src={classificationImagePaths[moveAnalyses[currentMoveIndex].classification]} 
                      alt="" 
                      className="cat-icon-img" 
                    />
                  )}
                  <span 
                    className="nav-step-badge" 
                    style={{
                      color: classificationMetadata[moveAnalyses[currentMoveIndex]?.classification]?.color,
                      backgroundColor: classificationMetadata[moveAnalyses[currentMoveIndex]?.classification]?.iconBg
                    }}
                  >
                    {classificationMetadata[moveAnalyses[currentMoveIndex]?.classification]?.label}
                  </span>
                </div>
              </div>

              <p className="walkthrough-move">
                {currentMoveIndex % 2 === 0 ? "White" : "Black"} played <strong>{moveAnalyses[currentMoveIndex]?.playedMoveStr}</strong>
              </p>

              <p className="walkthrough-desc">
                {moveAnalyses[currentMoveIndex]?.comment}
              </p>

              <div className="walkthrough-analysis-details">
                <div className="analysis-stat">
                  <span className="stat-label">Eval Change:</span>
                  <span className="stat-value">
                    {((moveAnalyses[currentMoveIndex]?.evalBefore ?? 0) > 0 ? "+" : "") + (moveAnalyses[currentMoveIndex]?.evalBefore ?? 0).toFixed(1)} 
                    {" → "} 
                    {((moveAnalyses[currentMoveIndex]?.evalAfter ?? 0) > 0 ? "+" : "") + (moveAnalyses[currentMoveIndex]?.evalAfter ?? 0).toFixed(1)}
                  </span>
                </div>
                {moveAnalyses[currentMoveIndex]?.bestMoveStr && moveAnalyses[currentMoveIndex]?.classification !== "best" && moveAnalyses[currentMoveIndex]?.classification !== "book" && (
                  <div className="analysis-stat">
                    <span className="stat-label">Best Move:</span>
                    <span className="stat-value best-move-text">{moveAnalyses[currentMoveIndex]?.bestMoveStr}</span>
                  </div>
                )}
                {moveAnalyses[currentMoveIndex]?.continuationLine && (
                  <div className="analysis-stat">
                    <span className="stat-label">Alternative Line:</span>
                    <span className="stat-value continuation-text">{moveAnalyses[currentMoveIndex]?.continuationLine}</span>
                  </div>
                )}
              </div>

              {/* Stepper Navigation */}
              <div className="walkthrough-controls">
                <button
                  className="stepper-btn"
                  disabled={currentMoveIndex === -1}
                  onClick={() => onSelectMove(currentMoveIndex - 1)}
                >
                  <ChevronLeft size={16} />
                  <span>Prev</span>
                </button>
                <span className="stepper-pos">
                  {currentMoveIndex + 1} / {moveAnalyses.length}
                </span>
                <button
                  className="stepper-btn"
                  disabled={currentMoveIndex === moveAnalyses.length - 1}
                  onClick={() => onSelectMove(currentMoveIndex + 1)}
                >
                  <span>Next</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Close review / Return to Arena */}
      <button className="exit-review-btn flex-center" onClick={onCloseReview}>
        {isActiveMatch ? "Return to Match Arena" : "Exit Review"}
      </button>

      {/* Exit Review completely to Dashboard */}
      {onExitToDashboard && (
        <button className="exit-dashboard-btn flex-center" onClick={onExitToDashboard}>
          Exit to Dashboard
        </button>
      )}

      <style>{`
        .game-review-panel {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 16px;
          max-height: calc(100vh - 160px);
          overflow-y: auto;
          overflow-x: hidden;
        }

        .review-acc-container {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          background: rgba(0, 0, 0, 0.2);
          padding: 10px;
          border-radius: 12px;
          border: 1px solid var(--glass-border);
        }

        .acc-column {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .white-acc {
          justify-content: flex-start;
        }

        .black-acc {
          justify-content: flex-end;
          text-align: right;
          flex-direction: row-reverse;
        }

        .acc-color-dot {
          width: 8px;
          height: 24px;
          border-radius: 4px;
        }

        .acc-color-dot.white {
          background-color: #ffffff;
          box-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
        }

        .acc-color-dot.black {
          background-color: #1e293b;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .acc-val-box {
          display: flex;
          flex-direction: column;
        }

        .acc-title {
          font-size: 10px;
          color: var(--text-muted);
          text-transform: uppercase;
          font-weight: 700;
        }

        .acc-percent {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .review-vs {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          padding: 0 8px;
        }

        .rating-estimates {
          padding: 0;
        }

        .rating-card {
          gap: 12px;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          border-radius: 10px;
          justify-content: flex-start;
        }

        .rating-content h4 {
          font-size: 12px;
          color: var(--text-secondary);
          font-weight: 600;
          text-align: left;
        }

        .rating-content p {
          font-size: 13px;
          color: var(--text-muted);
          text-align: left;
        }

        .rating-content strong {
          color: #ffffff;
        }

        .eval-chart-wrapper {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .chart-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          text-align: left;
        }

        .chart-canvas-container {
          background: rgba(0, 0, 0, 0.25);
          border-radius: 10px;
          border: 1px solid var(--glass-border);
          overflow: hidden;
          padding: 4px;
          min-height: 100px;
        }

        .eval-svg {
          width: 100%;
          height: auto;
          display: block;
          overflow: visible;
        }

        .chart-polyline {
          filter: drop-shadow(0 2px 5px rgba(99, 102, 241, 0.4));
        }

        .chart-point {
          cursor: pointer;
          transition: r 0.15s ease, stroke-width 0.15s ease;
        }

        .chart-point:hover {
          r: 6px;
        }

        .classifications-table {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding-right: 4px;
        }

        .table-header {
          display: grid;
          grid-template-columns: 50px 1fr 50px;
          align-items: center;
          text-align: center;
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          padding: 4px 8px;
          border-bottom: 1px solid var(--glass-border);
        }

        .table-row {
          display: grid;
          grid-template-columns: 50px 1fr 50px;
          align-items: center;
          text-align: center;
          padding: 6px 8px;
          background: rgba(255, 255, 255, 0.01);
          border-radius: 6px;
          border: 1px solid transparent;
        }

        .count-col {
          font-size: 14px;
          font-weight: 700;
        }

        .white-count {
          color: #ffffff;
        }

        .black-count {
          color: var(--text-muted);
        }

        .category-col {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
        }

        .cat-badge {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 800;
        }

        .cat-label {
          min-width: 80px;
          text-align: left;
        }

        .walkthrough-panel {
          padding: 12px 16px;
          background: rgba(10, 15, 29, 0.4);
          display: flex;
          flex-direction: column;
          gap: 8px;
          border-color: rgba(99, 102, 241, 0.2);
        }

        .walkthrough-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .walkthrough-header h4 {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .nav-step-badge {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .walkthrough-move {
          font-size: 14px;
          color: var(--text-primary);
          text-align: left;
        }

        .walkthrough-desc {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.4;
          text-align: left;
          min-height: 48px;
        }

        .walkthrough-analysis-details {
          display: flex;
          flex-direction: column;
          gap: 6px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 6px;
          padding: 8px;
          margin: 4px 0;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .analysis-stat {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 12px;
          line-height: 1.4;
        }

        .stat-label {
          color: var(--text-muted);
          font-weight: 600;
          min-width: 90px;
          flex-shrink: 0;
          text-align: right;
        }

        .stat-value {
          color: var(--text-primary);
          font-family: var(--font-mono);
          word-break: break-word;
        }

        .best-move-text {
          color: var(--accent-primary);
          font-weight: 700;
        }

        .continuation-text {
          font-size: 11px;
          color: var(--text-secondary);
        }

        .walkthrough-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 4px;
          background: rgba(0, 0, 0, 0.15);
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          padding: 4px;
        }

        .stepper-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          background: transparent;
          border-radius: 6px;
          transition: all var(--transition-fast);
        }

        .stepper-btn:hover:not(:disabled) {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.05);
        }

        .stepper-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .stepper-pos {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-muted);
        }

        .exit-review-btn {
          margin-top: 4px;
          width: 100%;
          padding: 10px;
          border-radius: 8px;
          background: var(--accent-primary);
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
          transition: all var(--transition-fast);
          box-shadow: 0 4px 10px rgba(99, 102, 241, 0.3);
        }

        .exit-review-btn:hover {
          background: var(--accent-primary-hover);
          box-shadow: 0 6px 15px rgba(99, 102, 241, 0.5);
          transform: translateY(-1px);
        }

        .exit-dashboard-btn {
          margin-top: 4px;
          width: 100%;
          padding: 10px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          color: var(--text-secondary);
          font-size: 14px;
          font-weight: 600;
          transition: all var(--transition-fast);
        }

        .exit-dashboard-btn:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.14);
          color: var(--text-primary);
        }

        .review-opening-container {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: rgba(217, 119, 6, 0.05);
          border: 1px solid rgba(217, 119, 6, 0.2);
          border-radius: 10px;
        }

        .review-opening-label {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #d97706;
          background: rgba(217, 119, 6, 0.15);
          padding: 2px 5px;
          border-radius: 4px;
          font-family: var(--font-mono);
        }

        .review-opening-name {
          font-size: 12.5px;
          font-weight: 600;
          color: var(--text-primary);
          text-align: left;
        }

        .cat-icon-img {
          width: 22px;
          height: 22px;
          object-fit: contain;
          flex-shrink: 0;
        }

        .chart-skeleton-loader {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          height: 100%;
          min-height: 120px;
          color: var(--text-muted);
          font-size: 13px;
        }

        .skeleton-spinner {
          width: 24px;
          height: 24px;
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-top-color: var(--accent-primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
