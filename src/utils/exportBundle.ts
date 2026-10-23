import JSZip from 'jszip';
import { GlobalPluginSettings } from '../types/plugin';
import {
  generateMacInstallScript,
  generateManifestJson,
  generatePluginNodeBackend,
  generatePropertyInspectorHtml,
  generateReadmeMarkdown,
  generateWindowsInstallScript,
  PLUGIN_UUID,
  SD_PLUGIN_FOLDER,
} from '../pluginTemplates/generatePluginFiles';

type IconGlyph = 'plugin' | 'fixed' | 'dynamic' | 'plus' | 'minus' | 'reset' | 'folder' | 'blankKey';

async function renderStreamDeckIconPng(size: number, glyph: IconGlyph, isKeyFace = false): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  if (isKeyFace) {
    // Subtle neutral dark key background so Stream Deck's native Title / user custom icons work cleanly
    ctx.fillStyle = '#141820';
    ctx.fillRect(0, 0, size, size);
  } else {
    ctx.clearRect(0, 0, size, size);
  }

  if (glyph === 'blankKey') {
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
  }

  const strokeColor = isKeyFace ? '#94A3B8' : '#CFCFCF';
  ctx.strokeStyle = strokeColor;
  ctx.fillStyle = strokeColor;
  ctx.lineWidth = Math.max(1.5, size * 0.08);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.28;

  if (glyph === 'plugin' || glyph === 'dynamic') {
    // Clean circular replay arc
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 0.2, Math.PI * 1.85);
    ctx.stroke();
    // Small arrow tip
    const tipX = cx + r * Math.cos(Math.PI * 0.2);
    const tipY = cy - r * Math.sin(Math.PI * 0.2);
    ctx.beginPath();
    ctx.moveTo(tipX - size * 0.1, tipY - size * 0.04);
    ctx.lineTo(tipX + size * 0.02, tipY + size * 0.06);
    ctx.lineTo(tipX + size * 0.08, tipY - size * 0.09);
    ctx.stroke();
  } else if (glyph === 'fixed') {
    // Clean clapper / frame rectangle
    const w = size * 0.56;
    const h = size * 0.42;
    ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.06, cy - size * 0.09);
    ctx.lineTo(cx + size * 0.1, cy);
    ctx.lineTo(cx - size * 0.06, cy + size * 0.09);
    ctx.closePath();
    ctx.fill();
  } else if (glyph === 'plus') {
    const arm = size * 0.24;
    ctx.beginPath();
    ctx.moveTo(cx - arm, cy);
    ctx.lineTo(cx + arm, cy);
    ctx.moveTo(cx, cy - arm);
    ctx.lineTo(cx, cy + arm);
    ctx.stroke();
  } else if (glyph === 'minus') {
    const arm = size * 0.24;
    ctx.beginPath();
    ctx.moveTo(cx - arm, cy);
    ctx.lineTo(cx + arm, cy);
    ctx.stroke();
  } else if (glyph === 'reset') {
    // Counter-clockwise reset arrow with center dot
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.92, -Math.PI * 0.75, Math.PI * 0.85, false);
    ctx.stroke();
    const rx = cx + r * 0.92 * Math.cos(-Math.PI * 0.75);
    const ry = cy + r * 0.92 * Math.sin(-Math.PI * 0.75);
    ctx.beginPath();
    ctx.moveTo(rx - size * 0.03, ry - size * 0.11);
    ctx.lineTo(rx - size * 0.04, ry + size * 0.03);
    ctx.lineTo(rx + size * 0.1, ry + size * 0.02);
    ctx.stroke();
  } else if (glyph === 'folder') {
    const w = size * 0.58;
    const h = size * 0.42;
    const left = cx - w / 2;
    const top = cy - h / 2 + size * 0.04;
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left + w * 0.36, top);
    ctx.lineTo(left + w * 0.46, top + h * 0.18);
    ctx.lineTo(left + w, top + h * 0.18);
    ctx.lineTo(left + w, top + h);
    ctx.lineTo(left, top + h);
    ctx.closePath();
    ctx.stroke();
  }

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
}

async function populateSdPluginDirectory(sdRoot: JSZip, settings: GlobalPluginSettings): Promise<void> {
  sdRoot.file('manifest.json', generateManifestJson());
  sdRoot.file('bin/plugin.mjs', generatePluginNodeBackend(settings), { unixPermissions: '755' });
  sdRoot.file('ui/property-inspector.html', generatePropertyInspectorHtml(settings));

  const imgs = sdRoot.folder('imgs')!;

  // Plugin & Category icons
  imgs.file('plugin.png', await renderStreamDeckIconPng(256, 'plugin', true));
  imgs.file('plugin@2x.png', await renderStreamDeckIconPng(512, 'plugin', true));
  imgs.file('category.png', await renderStreamDeckIconPng(28, 'plugin', false));
  imgs.file('category@2x.png', await renderStreamDeckIconPng(56, 'plugin', false));

  // Action sidebar icons (20x20 & 40x40 per Elgato SDK spec)
  imgs.file('action-fixed.png', await renderStreamDeckIconPng(20, 'fixed', false));
  imgs.file('action-fixed@2x.png', await renderStreamDeckIconPng(40, 'fixed', false));
  imgs.file('action-dynamic.png', await renderStreamDeckIconPng(20, 'dynamic', false));
  imgs.file('action-dynamic@2x.png', await renderStreamDeckIconPng(40, 'dynamic', false));
  imgs.file('action-plus.png', await renderStreamDeckIconPng(20, 'plus', false));
  imgs.file('action-plus@2x.png', await renderStreamDeckIconPng(40, 'plus', false));
  imgs.file('action-minus.png', await renderStreamDeckIconPng(20, 'minus', false));
  imgs.file('action-minus@2x.png', await renderStreamDeckIconPng(40, 'minus', false));
  imgs.file('action-reset.png', await renderStreamDeckIconPng(20, 'reset', false));
  imgs.file('action-reset@2x.png', await renderStreamDeckIconPng(40, 'reset', false));
  imgs.file('action-folder.png', await renderStreamDeckIconPng(20, 'folder', false));
  imgs.file('action-folder@2x.png', await renderStreamDeckIconPng(40, 'folder', false));
  imgs.file('action-captures.png', await renderStreamDeckIconPng(20, 'folder', false));
  imgs.file('action-captures@2x.png', await renderStreamDeckIconPng(40, 'folder', false));

  // Default key canvas states (72x72 & 144x144 — clean dark neutral so Stream Deck's native editor controls text/images)
  imgs.file('key-default.png', await renderStreamDeckIconPng(72, 'blankKey', true));
  imgs.file('key-default@2x.png', await renderStreamDeckIconPng(144, 'blankKey', true));
  imgs.file('key-dynamic.png', await renderStreamDeckIconPng(72, 'blankKey', true));
  imgs.file('key-dynamic@2x.png', await renderStreamDeckIconPng(144, 'blankKey', true));
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Downloads the native double-click Elgato installer (.streamDeckPlugin)
 */
export async function downloadStreamDeckPluginInstaller(settings: GlobalPluginSettings): Promise<void> {
  const zip = new JSZip();
  const sdFolder = zip.folder(SD_PLUGIN_FOLDER)!;
  await populateSdPluginDirectory(sdFolder, settings);

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  triggerBrowserDownload(blob, `${PLUGIN_UUID}.streamDeckPlugin`);
}

/**
 * Downloads a full .zip archive containing the .sdPlugin folder + 1-click Windows/macOS install scripts + README
 */
export async function downloadFullPluginZipBundle(settings: GlobalPluginSettings): Promise<void> {
  const zip = new JSZip();
  const sdFolder = zip.folder(SD_PLUGIN_FOLDER)!;
  await populateSdPluginDirectory(sdFolder, settings);

  zip.file('install-windows.bat', generateWindowsInstallScript());
  zip.file('install-mac.command', generateMacInstallScript(), { unixPermissions: '755' });
  zip.file('README.md', generateReadmeMarkdown());

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  triggerBrowserDownload(blob, 'ReplaySlice-StreamDeck-Plugin.zip');
}
