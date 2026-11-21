import React from 'react';

export function AuthBridgeView(): any { return null; }

const iconNames = [
  'BookOpen', 'ClipboardCheck', 'FileBarChart2', 'LayoutDashboard', 'LogOut', 'Moon',
  'Settings', 'Sun', 'Users', 'Lightbulb', 'CheckCircle2', 'KeyRound', 'Loader2',
  'Server', 'ShieldAlert', 'XCircle',
];

for (const name of iconNames) {
  (globalThis as any)['__RSI_ICONS_' + name] = null;
}

// Build a Proxy-based module via CommonJS interop is not possible in ESM shim;
// instead export each icon as a simple component.
export const BookOpen = makeIcon();
export const ClipboardCheck = makeIcon();
export const FileBarChart2 = makeIcon();
export const LayoutDashboard = makeIcon();
export const LogOut = makeIcon();
export const Moon = makeIcon();
export const Settings = makeIcon();
export const Sun = makeIcon();
export const Users = makeIcon();
export const Lightbulb = makeIcon();
export const CheckCircle2 = makeIcon();
export const KeyRound = makeIcon();
export const Loader2 = makeIcon();
export const Server = makeIcon();
export const ShieldAlert = makeIcon();
export const XCircle = makeIcon();

function makeIcon() {
  return function Icon(_props: any) {
    return null;
  };
}
