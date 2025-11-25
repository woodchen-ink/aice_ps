
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { XMarkIcon } from './icons';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave }) => {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const storedKey = localStorage.getItem('gemini-api-key') || '';
      const storedBaseUrl = localStorage.getItem('gemini-base-url') || '';
      setApiKey(storedKey);
      setBaseUrl(storedBaseUrl);
      setIsSaved(false); // Reset saved status on open
    }
  }, [isOpen]);
  
  const handleSave = () => {
    localStorage.setItem('gemini-api-key', apiKey);
    localStorage.setItem('gemini-base-url', baseUrl);
    setIsSaved(true);
    onSave();
    // Optionally close the modal after a short delay
    setTimeout(() => {
        onClose();
    }, 1000);
  };
  
  const handleClear = () => {
    localStorage.removeItem('gemini-api-key');
    localStorage.removeItem('gemini-base-url');
    setApiKey('');
    setBaseUrl('');
    setIsSaved(false);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in" onClick={onClose} aria-modal="true" role="dialog">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl shadow-blue-500/10 w-full max-w-lg m-4 p-6 text-gray-200 relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors" aria-label="关闭设置">
          <XMarkIcon className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold mb-6">API 设置</h2>

        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <label htmlFor="api-key-input" className="font-semibold text-gray-300">
                    Gemini API Key
                </label>
                <input
                    id="api-key-input"
                    type="password"
                    value={apiKey}
                    onChange={(e) => {
                        setApiKey(e.target.value);
                        setIsSaved(false);
                    }}
                    placeholder="在此处粘贴您的 API 密钥"
                    className="bg-gray-900 border border-gray-600 text-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                />
                <p className="text-xs text-gray-400 mt-1 px-1">提示：官方 Gemini API 密钥通常以 `AIzaSy...` 开头。如果您使用自定义 Base URL 或代理服务（例如，需要 `sk-...` 格式密钥的服务），密钥格式可能会有所不同。本应用将直接使用您提供的设置。</p>
            </div>
            
            <div className="flex flex-col gap-2">
                <label htmlFor="base-url-input" className="font-semibold text-gray-300">
                    API Base URL (可选)
                </label>
                <input
                    id="base-url-input"
                    type="text"
                    value={baseUrl}
                    onChange={(e) => {
                        setBaseUrl(e.target.value);
                        setIsSaved(false);
                    }}
                    placeholder="例如: https://apis.kuai.host/"
                    className="bg-gray-900 border border-gray-600 text-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                />
                 <p className="text-xs text-gray-400 mt-1 px-1">
                    用于指定 API 的根地址。如果不填，默认使用 Google 官方地址。请填写完整的 URL，例如 <code>https://your-proxy.com</code> (无需包含 /v1beta 等版本号)。
                </p>
            </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-4">
            <button
                onClick={handleClear}
                className="flex-1 bg-gray-700/50 text-gray-300 font-bold py-3 px-6 rounded-lg transition-colors hover:bg-gray-700/80 active:scale-95"
            >
                清除
            </button>
            <button
                onClick={handleSave}
                className="flex-1 bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed"
                disabled={isSaved}
            >
                {isSaved ? '已保存！' : '保存设置'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
