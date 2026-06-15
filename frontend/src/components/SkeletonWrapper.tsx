import React from "react";

export const SkeletonWrapper: React.FC<{ loading: boolean; children: React.ReactNode }> = ({ loading, children }) => {
  return loading ? (
    <div className="skeleton-wrapper">
      {children}
    </div>
  ) : (
    <>{children}</>
  );
};
