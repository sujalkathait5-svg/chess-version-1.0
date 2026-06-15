import React from "react";

interface EvaluationBarProps {
  evaluation: number | null;
  mate: number | null;
  flipMode: boolean; // if board is flipped, we want to align the bar accordingly
}

export const EvaluationBar: React.FC<EvaluationBarProps> = ({ evaluation, mate, flipMode }) => {
  // Calculate percentage of White portion (bottom of the bar)
  const getPercentage = (): number => {
    if (mate !== null) {
      // White has mate
      if (mate > 0) return flipMode ? 0 : 100;
      // Black has mate
      return flipMode ? 100 : 0;
    }
    if (evaluation === null) return 50;

    // Clamp evaluation to [-8.0, 8.0]
    const clamped = Math.max(-8, Math.min(8, evaluation));
    
    // Map -8 to 0% and +8 to 100%
    let percent = ((clamped + 8) / 16) * 100;
    
    // If board is flipped, Black is on bottom, so invert percentage
    if (flipMode) {
      percent = 100 - percent;
    }
    
    // Bounded between 5% and 95% to ensure a tiny sliver of the other side remains visible
    return Math.max(5, Math.min(95, percent));
  };

  const whitePercent = getPercentage();
  const blackPercent = 100 - whitePercent;

  // Format the text label to display
  const getLabel = (): string => {
    if (mate !== null) {
      return `M${Math.abs(mate)}`;
    }
    if (evaluation === null) return "0.0";
    const sign = evaluation > 0 ? "+" : "";
    return `${sign}${evaluation.toFixed(1)}`;
  };

  const label = getLabel();
  
  // Decide where to put the label (on the winning color side)
  // If White is better (percentage > 50), put it in the White portion (at the bottom or top depending on flipMode)
  // If Black is better, put it in the Black portion.
  const isWhiteWinning = mate !== null ? mate > 0 : (evaluation ?? 0) >= 0;
  
  // Determine if text should be at top or bottom
  // If White is winning and not flipped: White is bottom, so put text near bottom.
  // If Black is winning and not flipped: Black is top, so put text near top.
  const alignBottom = flipMode ? !isWhiteWinning : isWhiteWinning;

  return (
    <div className="eval-bar-container">
      <div className="eval-bar">
        {/* Top Area */}
        <div 
          className={`eval-side ${flipMode ? "white-side" : "black-side"}`} 
          style={{ height: `${flipMode ? whitePercent : blackPercent}%` }}
        />
        {/* Bottom Area */}
        <div 
          className={`eval-side ${flipMode ? "black-side" : "white-side"}`} 
          style={{ height: `${flipMode ? blackPercent : whitePercent}%` }}
        />

        {/* Eval Value Text Overlay */}
        <span 
          className={`eval-text ${isWhiteWinning ? "white-win-text" : "black-win-text"}`}
          style={{
            top: alignBottom ? "auto" : "12px",
            bottom: alignBottom ? "12px" : "auto",
          }}
        >
          {label}
        </span>
      </div>

      <style>{`
        .eval-bar-container {
          width: 24px;
          height: 100%;
          display: flex;
          flex-direction: column;
          position: relative;
          border-radius: 6px;
          overflow: hidden;
          border: 1px solid var(--glass-border);
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
          background: #141c30;
        }

        .eval-bar {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .eval-side {
          width: 100%;
          transition: height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .white-side {
          background-color: #e2e8f0; /* Crisp slate-100 */
        }

        .black-side {
          background-color: #1e293b; /* Slate-800 */
        }

        .eval-text {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          font-size: 10px;
          font-weight: 800;
          font-family: var(--font-family);
          pointer-events: none;
          z-index: 15;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }

        .white-win-text {
          color: #0f172a; /* Dark text for light background */
        }

        .black-win-text {
          color: #f8fafc; /* Light text for dark background */
        }
      `}</style>
    </div>
  );
};
