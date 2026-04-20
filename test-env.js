const fs = require('fs');
const content = fs.readFileSync('.env', 'utf-8');
content.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim().replace(/^['"](.*)['"]$/, '$1');
    if (key && value) {
      process.env[key] = value;
    }
  }
});
console.log('GOOGLE_CLIENT_ID length:', process.env.GOOGLE_CLIENT_ID?.length ?? 0);
console.log('GOOGLE_CLIENT_ID (json):', JSON.stringify(process.env.GOOGLE_CLIENT_ID));
console.log('ENCRYPTION_KEY (json):', JSON.stringify(process.env.ENCRYPTION_KEY));
