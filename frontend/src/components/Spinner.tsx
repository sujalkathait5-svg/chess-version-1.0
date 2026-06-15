import React from "react";
import { Loader } from "lucide-react";

export const Spinner: React.FC<{ size?: number }> = ({ size = 48 }) => (
  <div className="spinner-overlay" aria-live="polite" role="status">
    <Loader className="spinner-icon" size={size} />
  </div>
);
