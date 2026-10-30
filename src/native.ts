import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { MouseEvent } from 'react';

export function openExternal(event: MouseEvent<HTMLAnchorElement>) {
  if (Capacitor.isNativePlatform()) {
    event.preventDefault();
    // A new window is delegated to Android's external browser by Capacitor.
    window.open(event.currentTarget.href, '_system');
  }
}

export function installAndroidBack(view: () => string, goHome: () => void) {
  if (Capacitor.getPlatform() !== 'android') return;
  let disposed = false;
  const listener = App.addListener('backButton', () => {
    const dialog = document.querySelector<HTMLDialogElement>('dialog[open]');
    if (dialog) dialog.close();
    else if (view() !== 'translate') goHome();
    else void App.minimizeApp();
  });
  void listener.then(handle => { if (disposed) void handle.remove(); });
  return () => { disposed = true; void listener.then(handle => handle.remove()); };
}

export async function exportFile(name: string, contents: string, type: string) {
  if (Capacitor.isNativePlatform()) {
    await Filesystem.writeFile({ path: name, data: contents, directory: Directory.Cache, encoding: Encoding.UTF8 });
    const { uri } = await Filesystem.getUri({ path: name, directory: Directory.Cache });
    await Share.share({ title: name, files: [uri] });
  } else {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
