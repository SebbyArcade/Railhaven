/** ⚙ Settings on the home screen (and its pages): start a new map, or bring a game over from the old Railhaven (its save file, a pasted code, or this browser's old save). */
export function gameHtml(page: string | undefined, hasOld: boolean, report: string[] | null, code: string | null = null, stats: string | null = null, snd = { music: true, sfx: true }): string {
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
  if (page === 'paste') {
    return `<div class="head"><b class="big">📋</b><div><h2>Paste a save code</h2><span class="chip2">a code from 📤 Move my game, here or in the old game</span></div></div>`
      + `<textarea id="pasteCode" rows="4" placeholder="RAILHAVEN3:… or RAILHAVEN2:…" style="width:100%;box-sizing:border-box;border-radius:10px;background:#15110c;color:#f3e6c8;border:1px solid #8a6a3e;padding:6px;font-size:12px"></textarea>`
      + `<button class="act" data-act="loadpaste">📥 Load this game</button>` + back;
  }
  return `<div class="head"><b class="big">🗺</b><div><h2>Settings</h2><span class="chip2">your games save by themselves</span></div></div>`
    + (hasOld ? `<div class="gift">🚂 This browser has a game from the old Railhaven. <button class="act" data-act="loadold">📥 Bring it over</button></div>` : '')
    + `<div class="tiles"><button class="tile" data-act="page" data-page="move">📤 Move my game<small>to Chrome or the Claude app</small></button><button class="tile" data-act="loadfile">📂 Load a save file<small>from here or the old game</small></button><button class="tile" data-act="page" data-page="paste">📋 Paste a code<small>from here or the old game</small></button><button class="tile" data-act="page" data-page="stats">📊 Game report<small>to copy into the chat</small></button></div>`
    + `<div class="note">A game you load goes into a new slot in 🗂 Your games: the one you are playing stays saved.</div>`
    + `<div class="tiles"><button class="tile${snd.music ? ' on' : ''}" data-act="snd" data-k="music">${snd.music ? '🎵' : '🔇'} Music<small>${snd.music ? 'on · tap to turn off' : 'off · tap to turn on'}</small></button><button class="tile${snd.sfx ? ' on' : ''}" data-act="snd" data-k="sfx">${snd.sfx ? '🔊' : '🔇'} Sounds<small>${snd.sfx ? 'on · what you see on the map' : 'off · tap to turn on'}</small></button></div>`
    + `<button class="act alt" data-act="full">⛶ Full screen</button>`
    + `<button class="act back" data-act="page" data-page="">‹ Back</button>`;
}
