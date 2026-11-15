import type { SoundSettings } from '../audio/sound.ts';
/** The game's own web address (Firebase Hosting), set when the publish workflow builds it; empty in other builds. */
export const APP_URL: string = (import.meta as any).env?.VITE_APP_URL ?? '';

/** ⚙ Settings on the home screen (and its pages): start a new map, or bring a game over from the old Railhaven (its save file, a pasted code, or this browser's old save). */
/** A row of five bars that grow taller: tap one to set the volume (0 = off shows them all empty). */
function volRow(label: string, k: 'musicVol' | 'sfxVol', on: number): string {
  let bars = '';
  for (let v = 1; v <= 5; v++) bars += `<button class="vb${v <= on ? ' on' : ''}" data-act="vol" data-k="${k}" data-v="${v}" aria-label="${label} ${v} of 5"><i style="height:${8 + v * 5}px"></i></button>`;
  return `<div class="vol"><span>${label}</span><div class="vbars">${bars}</div></div>`;
}

export function gameHtml(page: string | undefined, hasOld: boolean, report: string[] | null, code: string | null = null, stats: string | null = null, snd: SoundSettings = { music: true, sfx: true, musicVol: 3, sfxVol: 3, muted: false }, app = { online: false, installed: false, offer: false }): string {
  const back = `<button class="act back" data-act="page" data-page="settings">‹ Back</button>`;
  if (page === 'report' && report) {
    return `<div class="head"><b class="big">🚂</b><div><h2>Your game is here</h2><span class="chip2">from the old Railhaven</span></div></div>`
      + report.map(r => `<div class="row"><div class="grow">${r}</div></div>`).join('')
      + `<div class="note">Buildings stand as close as they fit to where they were: each has a 2×4 yard now. Anything that couldn't be placed was paid back, so you can build it again.</div>`
      + `<button class="act" data-act="close">🚂 Let's go</button>`;
  }
  if (page === 'move') {
    return `<div class="head"><b class="big">📤</b><div><h2>Move my game</h2><span class="chip2">Chrome and the Claude app each keep their own game</span></div></div>`
      + `<div class="tiles"><button class="tile" data-act="copycode">📋 Copy my code<small>then paste it on the other side</small></button><button class="tile" data-act="savefile">💾 Save to a file<small>railhaven-save.txt</small></button></div>`
      + (code ? `<textarea id="myCode" rows="3" readonly style="width:100%;box-sizing:border-box;border-radius:10px;background:#15110c;color:#f3e6c8;border:1px solid #8a6a3e;padding:6px;font-size:11px">${code}</textarea><div class="note">If copying didn't work, press on the code, Select all, then Copy.</div>` : '')
      + `<div class="note">On the other side: 🏠 Home → ⚙ Settings → 📋 Paste a code, or 📂 Load a save file.</div>` + back;
  }
  if (page === 'stats' && stats) {
    return `<div class="head"><b class="big">📊</b><div><h2>Game report</h2><span class="chip2">paste it in the chat when something feels off</span></div></div>`
      + `<button class="act" data-act="copystats">📋 Copy the report</button>`
      + `<textarea id="stats" rows="14" readonly style="width:100%;box-sizing:border-box;border-radius:10px;background:#15110c;color:#f3e6c8;border:1px solid #8a6a3e;padding:6px;font-size:11px">${stats.replace(/[&<>]/g, c => `&#${c.charCodeAt(0)};`)}</textarea>` + back;
  }
  if (page === 'app') {
    return `<div class="head"><b class="big">📲</b><div><h2>Install the game</h2><span class="chip2">an icon on your home screen</span></div></div>`
      + (app.installed ? `<div class="note">✅ Railhaven is installed on this phone. Open it from its icon.</div>`
        : app.online ? (app.offer ? `<button class="act" data-act="install">📲 Install Railhaven</button>` : `<div class="note">In Chrome, open the ⋮ menu and tap <b>Install app</b> or <b>Add to home screen</b>.</div>`)
        : `<div class="row"><span class="ico">🌐</span><div class="grow"><b>Open the game's web address in Chrome</b><small>${APP_URL ? `<a href="${APP_URL}" target="_blank" rel="noopener" style="color:#ffd27a">${APP_URL.replace('https://', '')}</a>` : 'the address Claude gave you (it ends in web.app)'}</small></div></div>`
          + `<div class="row"><span class="ico">📲</span><div class="grow"><b>Tap Install</b><small>in the game's ⚙ Settings, or Chrome's ⋮ menu → Install app</small></div></div>`)
      + `<div class="row"><span class="ico">⛶</span><div class="grow"><b>Full screen, no browser bars</b><small>it opens like an app</small></div></div>`
      + `<div class="row"><span class="ico">✈</span><div class="grow"><b>Plays offline</b><small>after the first visit, no connection needed</small></div></div>`
      + `<div class="note">The installed game keeps its own saves: bring yours over once with 📤 Move my game.</div>` + back;
  }
  if (page === 'paste') {
    return `<div class="head"><b class="big">📋</b><div><h2>Paste a save code</h2><span class="chip2">a code from 📤 Move my game, here or in the old game</span></div></div>`
      + `<textarea id="pasteCode" rows="4" placeholder="RAILHAVEN3:… or RAILHAVEN2:…" style="width:100%;box-sizing:border-box;border-radius:10px;background:#15110c;color:#f3e6c8;border:1px solid #8a6a3e;padding:6px;font-size:12px"></textarea>`
      + `<button class="act" data-act="loadpaste">📥 Load this game</button>` + back;
  }
  return `<div class="head"><b class="big">🗺</b><div><h2>Settings</h2><span class="chip2">your games save by themselves</span></div></div>`
    + (hasOld ? `<div class="gift">🚂 This browser has a game from the old Railhaven. <button class="act" data-act="loadold">📥 Bring it over</button></div>` : '')
    + `<div class="tiles"><button class="tile" data-act="page" data-page="move">📤 Move my game<small>to Chrome or the Claude app</small></button><button class="tile" data-act="loadfile">📂 Load a save file<small>from here or the old game</small></button><button class="tile" data-act="page" data-page="paste">📋 Paste a code<small>from here or the old game</small></button><button class="tile" data-act="page" data-page="stats">📊 Game report<small>to copy into the chat</small></button></div>`
    + `<div class="note">A game you load goes into a new slot in 🗂 Your games: the one you are playing stays saved.</div>`
    + (snd.muted ? `<div class="gift">🔇 The game is silenced with the button at the top right. <button class="act" data-act="unmute">🔊 Turn sound back on</button></div>` : '')
    + `<div class="tiles"><button class="tile${snd.music ? ' on' : ''}" data-act="snd" data-k="music">${snd.music ? '🎵' : '🔇'} Music<small>${snd.music ? 'on · tap to turn off' : 'off · tap to turn on'}</small></button><button class="tile${snd.sfx ? ' on' : ''}" data-act="snd" data-k="sfx">${snd.sfx ? '🔊' : '🔇'} Sounds<small>${snd.sfx ? 'on · what you see on the map' : 'off · tap to turn on'}</small></button></div>`
    + volRow('🎵 Music volume', 'musicVol', snd.music ? snd.musicVol : 0) + volRow('🔊 Sounds volume', 'sfxVol', snd.sfx ? snd.sfxVol : 0)
    + (app.installed ? '' : `<button class="act" data-act="page" data-page="app">📲 Install the game<small style="display:inline;margin-left:6px">home screen icon, full screen, plays offline</small></button>`)
    + `<button class="act alt" data-act="full">⛶ Full screen</button>`
    + `<button class="act back" data-act="page" data-page="">‹ Back</button>`;
}
