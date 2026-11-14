#!/bin/bash
cd "$(dirname "$0")"
python3 - <<'P'
b=open('base90.html').read();c=open('core90.js').read();m='requestAnimationFrame(loop);\n</script>';i=b.rindex(m)
open('railhaven-prototype.html','w').write(b[:i]+c+'\n'+b[i:])
P
node -e "const h=require('fs').readFileSync('railhaven-prototype.html','utf8');const s=h.match(/<script>([\s\S]*)<\/script>/)[1];new Function(s);console.log('syntax ok')"
