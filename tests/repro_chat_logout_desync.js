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

async function testLogoutBug() {
  console.log('--- Registering & logging in alice ---');
  await sandbox.AccountManager.register('alice', 'Alice', 'password123');
  console.log('Logged in as:', sandbox.AccountManager.getUsername());

  const badgeBefore = env.document.getElementById('chat-current-user-badge');
  console.log('Chat badge before logout:', badgeBefore ? badgeBefore.textContent : 'null');

  console.log('--- Logging out ---');
  sandbox.AccountManager.logout();
  console.log('AccountManager.getUsername() after logout:', sandbox.AccountManager.getUsername());

  const badgeAfter = env.document.getElementById('chat-current-user-badge');
  console.log('Chat badge after logout:', badgeAfter ? badgeAfter.textContent : 'null');

  console.log('--- Sending message after logout ---');
  const input = env.document.getElementById('chat-input-box');
  input.value = 'Message sent after logout';
  const sendBtn = env.document.getElementById('chat-send-btn');
  sendBtn.click();

  const msgs = JSON.parse(sandbox.localStorage.getItem('hub_chat_messages_v2'));
  const lastMsg = msgs[msgs.length - 1];
  console.log('Last chat message sender:', lastMsg.user);
  console.log('Last chat message verified:', lastMsg.verified);
}

testLogoutBug();
