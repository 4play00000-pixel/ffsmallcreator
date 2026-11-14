import React from 'react';

export interface NavItem {
  id: string;
  label: string;
}

interface TopBarProps {
  navItems: NavItem[];
  activeTab: string;
  onSelectTab: (id: string) => void;
  isAuthenticated: boolean;
  onAuthAction: () => void;
  authLoading?: boolean;
}

export function TopBar({
  navItems,
  activeTab,
  onSelectTab,
  isAuthenticated,
  onAuthAction,
  authLoading = false,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab(navItems[0]?.id || 'overview')}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          FF Creator Hub
        </button>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                  isActive
                    ? 'text-slate-900'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[15px] h-0.5 bg-blue-600"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            disabled={authLoading}
            onClick={onAuthAction}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 ${
              isAuthenticated
                ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {authLoading ? 'Attendere...' : isAuthenticated ? 'Esci' : 'Accedi con Google'}
          </button>
        </div>
      </div>

      {/* Mobile navigation strip when authenticated */}
      {navItems.length > 0 && (
        <nav className="flex md:hidden items-center gap-4 overflow-x-auto border-t border-slate-100 px-4 py-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`text-xs font-medium py-1 whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive ? 'text-blue-600 font-semibold' : 'text-slate-600'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      )}
    </header>
  );
}
