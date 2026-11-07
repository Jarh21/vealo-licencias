const { spawn } = require('child_process');
const path = require('path');

const server = spawn('node', ['server.js'], {
  stdio: 'inherit',
  shell: true,
});

setTimeout(() => {
  const tester = spawn('node', ['test-system.js'], {
    stdio: 'inherit',
    shell: true,
  });

  tester.on('exit', (code) => {
    console.log(`\nPruebas finalizadas con código: ${code}`);
    server.kill();
    // En Windows a veces hay subprocesos, forzar salida
    setTimeout(() => {
      process.exit(code);
    }, 1000);
  });
}, 2500);

