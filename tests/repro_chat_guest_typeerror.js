const { createBrowserEnvironment } = require('./harness');
const vm = require('vm');
const fs = require('fs');

const env = createBrowserEnvironment();
const sandbox = env.window;
sandbox.console = console;
const context = vm.createContext(sandbox);

function runScript(filename) {
  const code = fs.readFileSync(filename, 'utf8');
  const bridge = `
    if (typeof AccountManager !== 'undefined') window.AccountManager = AccountManager;
    if (typeof ChatApp !== 'undefined') window.ChatApp = ChatApp;
  `;
  return vm.runInContext(code + '\n' + bridge, context);
}

runScript('account.js');
runScript('chat.js');
sandbox.AccountManager.init();
sandbox.ChatApp.init();

console.log('Testing guest saveScratchpad:');
sandbox.AccountManager.saveScratchpad('test guest note');
console.log('Testing logout:');
sandbox.AccountManager.logout();
console.log('Done test');
