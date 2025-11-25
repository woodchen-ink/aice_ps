
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { Square2StackIcon, ChevronDownIcon } from './icons';

interface BatchSelectorProps {
  count: number;
  onChange: (count: number) => void;
  disabled?: boolean;
  max?: number;
}

const BatchSelector: React.FC<BatchSelectorProps> = ({ count, onChange, disabled, max = 8 }) => {
  return (
    <div className="relative inline-block text-left group/batch z-10">
      <button
        type="button"
        disabled={disabled}
        className="flex items-center gap-2 bg-white/5 border border-white/10 text-gray-200 px-3 py-2.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed h-full"
        title="批量生成数量"
      >
        <Square2StackIcon className="w-5 h-5 text-blue-400" />
        <span className="font-bold w-4 text-center">{count}</span>
        <ChevronDownIcon className="w-4 h-4 text-gray-500" />
      </button>
      
      <div className="absolute right-0 bottom-full mb-2 w-16 bg-gray-800 border border-gray-700 rounded-lg shadow-xl opacity-0 invisible group-hover/batch:opacity-100 group-hover/batch:visible transition-all duration-200 overflow-hidden flex flex-col-reverse max-h-48 overflow-y-auto custom-scrollbar">
         {Array.from({ length: max }, (_, i) => i + 1).map(num => (
            <button
                key={num}
                onClick={() => onChange(num)}
                className={`w-full px-2 py-2 text-sm font-medium text-center transition-colors hover:bg-blue-500/20 ${count === num ? 'bg-blue-600 text-white' : 'text-gray-300'}`}
            >
                {num}
            </button>
         ))}
      </div>
    </div>
  );
};

export default BatchSelector;
