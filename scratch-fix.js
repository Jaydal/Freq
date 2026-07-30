const fs = require('fs');
const files = [
  'web/src/app/api/display/publish-all/route.ts',
  'web/src/app/api/display/state/[courtId]/route.ts',
  'web/src/components/terminal/CourtOverview.tsx',
  'web/src/components/terminal/CourtStatusCard.tsx',
  'web/src/components/terminal/QueueBoard.tsx',
  'web/src/components/terminal/TerminalKiosk.tsx',
  'web/src/lib/display/sports-caster.test.ts',
  'web/src/lib/queue/booking-engine.ts',
  'web/src/lib/queue/queue-processor.ts',
  'web/src/lib/queue/queue-service.ts',
  'web/src/lib/queue/reservation-service.ts',
  'test-payload.ts',
  'web/src/components/display/DisplaySequenceEditorV2.tsx',
  'web/src/components/display/zone-types.ts',
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  
  // Remove effectivePrepSec imports and usages
  content = content.replace(/,\s*effectivePrepSec/g, '');
  content = content.replace(/effectivePrepSec,\s*/g, '');
  content = content.replace(/import\s*{\s*effectivePrepSec\s*}\s*from[^;]+;/g, '');
  
  // Remove prepTimeSec from object literals
  content = content.replace(/prepTimeSec:\s*[^,}]*,?/g, '');
  content = content.replace(/prepTimeSec,/g, '');
  
  // TerminalKiosk.tsx specifics
  content = content.replace(/const prep = \(c\.durationMin \?\? 0\) < 5 \? 0 : \(c\.prepTimeSec \?\? 0\);/g, 'const prep = 0;');
  content = content.replace(/const end = c\.startTime \+ prep \+ \(c\.durationMin \?\? 0\) \* 60;/g, 'const end = c.startTime + (c.durationMin ?? 0) * 60;');
  content = content.replace(/const rawPrepTime = court\.prepTimeSec \?\? 300;/g, '');
  content = content.replace(/const phase = phaseForElapsed\(elapsed, court\.prepTimeSec\);/g, 'const phase = "in_game";');
  
  // sports-caster.test.ts
  content = content.replace(/prep:\s*{\s*interval:\s*\d+,\s*pages:\s*\[\]\s*},?/g, '');
  
  // DisplaySequenceEditorV2.tsx
  content = content.replace(/'prep',\s*/g, '');
  content = content.replace(/'prep'\s*\|/g, '');
  content = content.replace(/\|\s*'prep'/g, '');
  content = content.replace(/prep:\s*{[^}]*},\s*/g, '');
  
  // zone-types.ts
  content = content.replace(/prep:\s*{\s*interval:\s*number;\s*pages:\s*ZonePage\[\]\s*};\s*/g, '');

  fs.writeFileSync(file, content);
}
console.log('done');
