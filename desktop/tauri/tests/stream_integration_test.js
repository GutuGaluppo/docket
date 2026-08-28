#!/usr/bin/env node
// Simple integration test: runs the Rust stream_tester binary and checks for DRIZZLE-COMPLETE
const { spawn } = require('child_process');
const path = require('path');

(async function(){
  try {
    // cargo run --bin stream_tester -- generate
    const proc = spawn('cargo', ['run', '--bin', 'stream_tester', '--', 'generate'], { cwd: path.resolve(__dirname, '..', '..'), shell: true });

    let stdout = '';
    let stderr = '';
    let gotComplete = false;

    proc.stdout.on('data', (d) => {
      const s = d.toString();
      process.stdout.write(s);
      stdout += s;
      if (s.includes('DRIZZLE-COMPLETE')) gotComplete = true;
    });
    proc.stderr.on('data', (d) => { stderr += d.toString(); process.stderr.write(d.toString()); });

    const exitCode = await new Promise((resolve) => proc.on('close', resolve));

    if (!gotComplete) {
      console.error('Did not receive DRIZZLE-COMPLETE in stdout');
      process.exit(2);
    }
    if (exitCode !== 0) {
      console.error('Process exit code != 0', exitCode);
      process.exit(exitCode);
    }
    console.log('STREAM TEST OK');
    process.exit(0);
  } catch (e) {
    console.error('Test error', e);
    process.exit(1);
  }
})();
