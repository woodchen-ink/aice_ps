
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

interface SpinnerProps {
    className?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ className = "h-12 w-12" }) => {
  return (
    <div className={`relative flex justify-center items-center ${className}`}>
      <div className="absolute animate-ping inline-flex h-full w-full rounded-full bg-blue-400 opacity-20"></div>
      <div className="relative inline-flex rounded-full h-full w-full border-4 border-t-blue-500 border-r-transparent border-b-purple-500 border-l-transparent animate-spin"></div>
    </div>
  );
};

export default Spinner;
