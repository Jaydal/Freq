const fs = require('fs');
let file = 'web/src/components/terminal/CourtStatusCard.tsx';
let content = fs.readFileSync(file, 'utf8');

// replace const phase = ... with const phase = isActive ? 'in_game' : null;
content = content.replace(/const phase = isActive \? phaseForElapsed\(elapsed, prepTime\) : null;/g, "const phase = isActive ? 'in_game' : null;");
// replace phaseForElapsed calls
content = content.replace(/phase === 'preparing'/g, 'false');
content = content.replace(/phase === 'in_game'/g, 'true');

fs.writeFileSync(file, content);

file = 'web/src/components/terminal/CourtOverview.tsx';
content = fs.readFileSync(file, 'utf8');
content = content.replace(/const phase = "in_game";/g, "const phase = 'in_game';");
content = content.replace(/phase === 'preparing'/g, 'false');
content = content.replace(/phase === 'in_game'/g, 'true');
fs.writeFileSync(file, content);
