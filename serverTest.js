require('dotenv').config();
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== Server Test ===');
console.log('Node.js version:', process.version);
console.log('Environment:', process.env.NODE_ENV);
console.log('Port:', process.env.PORT);
console.log('MongoDB URI:', process.env.MONGODB_URL || process.env.MONGODB_URI);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// File paths for logs
const stdoutPath = path.join(logsDir, 'server-stdout.log');
const stderrPath = path.join(logsDir, 'server-stderr.log');

// Create write streams
const stdoutStream = fs.createWriteStream(stdoutPath, { flags: 'a' });
const stderrStream = fs.createWriteStream(stderrPath, { flags: 'a' });

// Add timestamp to log entries
function timestamp() {
  return `[${new Date().toISOString()}] `;
}

console.log('Starting server in test mode...');
console.log('Logs will be written to:', logsDir);

// Start the server process
const server = spawn('node', ['index.js'], {
  env: { ...process.env, TEST_MODE: 'true' }
});

// Log server output with timestamps
server.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);
  stdoutStream.write(`${timestamp()}${output}`);
  
  // If the server has started successfully, we can exit this test process
  if (output.includes('Server is running on port')) {
    console.log('\n✅ Server started successfully!');
    console.log('Press Ctrl+C to stop the server');
  }
});

server.stderr.on('data', (data) => {
  const output = data.toString();
  process.stderr.write(output);
  stderrStream.write(`${timestamp()}${output}`);
});

server.on('close', (code) => {
  console.log(`\nServer process exited with code ${code}`);
  stdoutStream.end();
  stderrStream.end();
});

// Handle this script's termination
process.on('SIGINT', () => {
  console.log('\nStopping server test...');
  server.kill('SIGINT');
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

console.log('Test script is now monitoring the server...');
console.log('(Press Ctrl+C to stop)'); 