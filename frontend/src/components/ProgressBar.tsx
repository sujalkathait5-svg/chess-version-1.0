import React from "react";

interface ProgressBarProps {
  progress: number; // 0 to 100
  label?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, label }) => {
  const safeProgress = Math.min(100, Math.max(0, progress));
  return (
    <div className="progress-bar-wrapper">
      {label && <div className="progress-label">{label}</div>}
      <div className="progress-bar-bg">
        <div
          className="progress-bar-fill"
          style={{ width: `${safeProgress}%` }}
        ></div>
      </div>
    </div>
  );
};
