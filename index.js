const owoify = require('owoify-js').default;
const fetch = require("node-fetch");
const WebSocket = require("ws");
const {
  Client,
  GatewayIntentBits,
  WebhookClient,
} = require("discord.js");

const {
  token,
  chat_channel,
  webhook,
  admins,
  apiKey,
  apiUrl,
  serverId,
} = require("./config.json");
let owoState = "none"; // default owoify state
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

let latestPlayerStats = {
  online: 0,
  max: 0,
  players: [] // array of player names
};

const WEBHOOK = new WebhookClient({ url: webhook });

let ws = null;
let wsToken = null;
let wsUrl = null;
let reconnectTimer = null;
// Generic Pterodactyl API request function



async function ptero(endpoint, method = "GET", body, raw = false) {
  console.log(`Ptero API Request: ${method} ${endpoint}`);
  await console.log(`Body: ${body ? JSON.stringify(body) : "N/A"}`);
  const res = await fetch(`${apiUrl}/api/client${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "Application/vnd.pterodactyl.v1+json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API failed: ${res.status} ${text}`);
  }

  return raw ? res : res.json();
}
// Fetches WebSocket credentials from the Pterodactyl API
async function getWebsocketCreds() {
  const data = await ptero(`/servers/${serverId}/websocket`);
  wsToken = data.data.token;
  wsUrl = data.data.socket;
}
// Connects to the WebSocket server
function connectWebsocket() {
  if (!wsToken || !wsUrl) return;

  ws = new WebSocket(wsUrl, {
    headers: {
      Authorization: `Bearer ${wsToken}`,
      Origin: apiUrl,
    },
  });

  ws.on("open", () => {
    console.log("WS OPEN");
    ws.send(JSON.stringify({ event: "auth", args: [wsToken] }));
  });

  ws.on("message", async (data) => {
    let msg = JSON.parse(data.toString());
    playerStatsManager("update", msg.args?.[0] || "");
    const filtered = filterConsole(msg.args?.[0] || "");
    
    if (!filtered) return;
    if (owoState !== "none") {
      filtered.message = owoify(filtered.message, owoState);
    }
    console.log("WS MSG:", filtered);
    if (filtered.sender && filtered.message) {
      console.log(`WS LOG [${filtered.sender}]: ${filtered.message}`);
      try {
        await WEBHOOK.send({ 
          username: filtered.sender, 
          avatarURL: filtered.sender == "Server" ? `https://www.freeiconspng.com/download/40686` /*Minecraft Server Icon Download Vectors Free*/ : `https://minotar.net/avatar/${filtered.sender}`, 
          content: filtered.message, 
          flags: [4096],
        });
      } catch (err) {
        console.error("Webhook send error:", err);
      }
    }
  });

  ws.on("close", () => {
    console.warn("WS closed — reconnecting in 10s");
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(initWebsocket, 10000);
  });

  ws.on("error", console.error);
}
// Initializes the WebSocket connection
async function initWebsocket() {
  try {
    await getWebsocketCreds();
    connectWebsocket();
  } catch (err) {
    console.error("WS init failed:", err);
    setTimeout(initWebsocket, 8000);
  }
}
// Updates the Discord channel topic with server stats
async function updateChannelWithServerStats() {
  try {
    console.log("Updating channel topic with server stats...");
    const channel = await client.channels.fetch(chat_channel);
    const r = await ptero(`/servers/${serverId}/resources`);
    const s = r.attributes;
    await sendConsoleCommand("list"); // trigger player stats update
    // Get the latest player stats
    await new Promise(r => setTimeout(r, 800)); // wait a bit for WS to process "list" response
    const stats = playerStatsManager("get");

    // Get player count and list
    const playersOnline = stats.online;
    const maxPlayers = stats.max;
    const playerList = stats.players.length > 0 ? stats.players.join(", ") : "";

    // Optional: log for debugging
    console.log(`Players online: ${playersOnline}/${maxPlayers}`);
    console.log(`Player list: ${playerList}`);

    const topic =
      `State: ${s.current_state}` +
      ` | RAM: ${(s.resources.memory_bytes / 1048576).toFixed(0)}MB` +
      ` | Online: ${playersOnline}` + (playersOnline == "0" ? "" : `| Players: ${playerList}`);
    console.log("New topic:", topic);
    await channel.setTopic(topic);
  } catch (err) {
    console.error("Topic update failed:", err);
  }
}
// Sends a console command to the server
async function sendConsoleCommand(cmd) {
  // If WS is open, send via WS only
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log("Sending console command (WS):", cmd);
    try {ws.send(JSON.stringify({
      event: "send command",
      args: [cmd]
    }));
    } catch (err) {
      console.error("WS send command error:", err);
      ws.terminate();
      initWebsocket();
    }
    return ""; // no text response from WS send
  }
  
  // Otherwise fallback to REST API
  console.warn("WS not connected, using REST API for command:", cmd);
  const res = await ptero(`/servers/${serverId}/command`, "POST", {
    command: cmd
  }, true);
  const text = await res.text();
  return text;
}

// Power actions: start, stop, restart
async function power(action) {
  try {
    const res = await fetch(`${apiUrl}/api/client/servers/${serverId}/power`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "Application/vnd.pterodactyl.v1+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ signal: action }),
    });

    if (res.status === 204) {
      console.log(`Server ${action} successfully.`);
    } else {
      const text = await res.text();
      console.error("Error:", text);
    }
  } catch (err) {
    console.error(err);
  }
}
// Filters console lines for chat messages
function filterConsole(line) {
  if (typeof line !== "string") return null;

  const CHAT_REGEX =
    /^\[\d{2}:\d{2}:\d{2}\]\s+\[(?:Server thread|Netty Server IO #\d+)\/INFO\]:\s+(?:<([A-Za-z0-9_]{1,16})>\s+(.*)|\*\s+([A-Za-z0-9_]{1,16})\s+(.*)|([A-Za-z0-9_]{1,16})\s+(joined.*|left.*|was.+|fell.*|drowned.*|hit.*|tried.*|went.*|suff.*|burne.*|blew.*|disco.*|wither.*))$/;

  const match = line.match(CHAT_REGEX);
  if (!match) return null;

  if (match[1] && match[2]) return { sender: match[1], message: match[2] };
  if (match[3] && match[4]) return { sender: match[3], message: match[4] };
  if (match[5] && match[6]) {updateChannelWithServerStats(); return { sender: "Server", message: `${match[5]} ${match[6]}` };}

  return null;
}

/**
 * Player stats manager
 * @param {"update"|"get"} action - "update" to parse a line, "get" to return the current stats
 * @param {string} [line] - required if action is "update", the console line from WS
 * @returns {object|undefined} - returns current stats if "get", otherwise undefined
 */
function playerStatsManager(action, line) {
  if (action === "update") {
    if (!line || typeof line !== "string") return;

    const msgMatch = line.match(/^\[[^\]]+]\s+\[[^\]]+]:\s+(.*)$/);
    const msg = msgMatch ? msgMatch[1] : line;

  // Ignore panel / JSON noise
  // Player count
    const countMatch = msg.match(/There are (\d+)\/(\d+) players online/i);
    if (countMatch) {
      latestPlayerStats.online = parseInt(countMatch[1], 10);
      latestPlayerStats.max = parseInt(countMatch[2], 10);
      latestPlayerStats.players = [];
      return;
    }

    // Collect names
    if (latestPlayerStats.online > 0) {
      const raw = msg.trim();

      // Split both: "A, B" and "A" formats
      const parts = raw.split(",").map(p => p.trim());

      for (const name of parts) {
        if (/^[A-Za-z0-9_]{3,16}$/.test(name)) {
          if (!latestPlayerStats.players.includes(name)) {
            latestPlayerStats.players.push(name);
          }
        }
      }
    }


  } else if (action === "get") {
    return { ...latestPlayerStats }; // return a copy for safety
  }
}

client.on("clientReady", () => {
  console.log("Discord bot ready!");
  initWebsocket();
  setInterval(updateChannelWithServerStats, 300000);
});
// discord message handler
client.on("messageCreate", async (message) => {
  if (message.channel.id !== chat_channel) return;
  if (message.author.bot) return;

  let msg = message.content.trim();

  if (msg.startsWith("!")) {
    const args = msg.slice(1).split(" ");
    const cmd = args[0].toLowerCase();

    if (cmd === "help") {
      try {
        await WEBHOOK.send({ content: "Available commands:\n!help - shows this message\n!players - list the players in the server\n!backup <force> [name] - makes a server backup (admin only)\n!start - starts the server (admin only)\n!stop - stops the server (admin only)\n!restart - restarts the server (admin only)\n/<command> - sends a console command (admin only)\n!owoify [owo|uwu|uvu|none] - owoifies all messages", avatarURL: "https://www.freeiconspng.com/download/40686", username: "Server" , flags: [4096] });
      } catch (err) {
        console.error("Help command error:", err);
      }
    }
    if (cmd === "players") {
      try {
        // Get the latest player stats from the manager
        await sendConsoleCommand("list");
        await new Promise(r => setTimeout(r, 800));
        const stats = playerStatsManager("get");
        const listStr = stats.players.length > 0 ? stats.players.join(", ") : "None";
        try {
        await WEBHOOK.send({
          content: `There are ${stats.online}/${stats.max} players online` + (listStr !== "None" ? `:\n${listStr}` : ""),
          username: "Server",
          avatarURL: "https://www.freeiconspng.com/download/40686",
        });
      } catch (err) { console.error("Players webhook send error:", err); }
      } catch (err) {
        console.error("Players command error:", err);
        try {
        await WEBHOOK.send({
          content: "Failed to get player list.",
          username: "Server",
          avatarURL: "https://www.freeiconspng.com/download/40686",
        });
      } catch (err) { console.error("Webhook send error:", err); }
      }

    }
    if (cmd === "backup") {
      const force = admins.includes(message.author.id) && args[1] && args[1].toLowerCase() === "force";

      try {
        // list existing backups
        const listRes = await ptero(`/servers/${serverId}/backups`, "GET");
        const existing = listRes.data || [];
        console.log(`Existing backups: ${existing.length}`);
        if (existing.length >= 3) {
          if (!force) {
            return WEBHOOK.send({
              content: `Maximum number of backups reached (3). Use !backup force [name] to delete the oldest and create a new one.`,
              avatarURL: "https://www.freeiconspng.com/download/40686",
              username: "Server",
            });
          }

          // find oldest backup by created time
          existing.sort((a, b) => new Date(a.attributes.created_at) - new Date(b.attributes.created_at));
          console.log("Deleting oldest backup:", existing[0]);
          const oldest = existing[0];
          if (oldest && oldest.attributes && oldest.attributes.uuid) {
            await ptero(`/servers/${serverId}/backups/${oldest.attributes.uuid}`, "DELETE");
          }
        }

        // now create backup
        const name = force && args[2] ? args[2] : args[1] || "discord_backup";
        await ptero(`/servers/${serverId}/backups`, "POST", { name });
        try {
          await WEBHOOK.send({
            content: `Backup started! (force: ${force})`,
            avatarURL: "https://www.freeiconspng.com/download/40686",
            username: "Server",
            flags: [4096],
          });
        } catch (err) {
          console.error("Backup webhook send error:", err);
        }
      } catch (err) {
        console.error("Backup command error:", err);
        try { await WEBHOOK.send({ content: "Failed to handle backup command.", avatarURL: "https://www.freeiconspng.com/download/40686", username: "Server" , flags: [4096] }); } catch (err) { console.error("Webhook send error:", err); }
      }
}
    

    if (admins.includes(message.author.id)) {
      if (cmd === "start") {await power("start"); try {await WEBHOOK.send({ content: "Server starting...", avatarURL: "https://www.freeiconspng.com/download/40686", username: "Server" , flags: [4096] });} catch (err) {console.error("Start command error:", err);}}
      if (cmd === "stop") {await power("stop"); try {await WEBHOOK.send({ content: "Server stopping...", avatarURL: "https://www.freeiconspng.com/download/40686", username: "Server" , flags: [4096] });} catch (err) {console.error("Stop command error:", err);}}
      if (cmd === "restart") {
        await power("restart"); 
        try {
          await WEBHOOK.send({ content: "Server restarting...", avatarURL: "https://www.freeiconspng.com/download/40686", username: "Server" , flags: [4096] });
        } catch (err) {
          console.error("Restart command error:", err);
        }
      }
    }
    if (cmd === "owoify") {
      if (args[1] === "none" || args[1] === "uwu" || args[1] === "uvu" || args[1] === "owo") {
        owoState = args[1].toLowerCase();
      }
    }
      
  } else if (msg.startsWith("/") && admins.includes(message.author.id)) {
    const command = msg.slice(1);
    await sendConsoleCommand(command);
  } else {
    console.log(`Discord LOG [${message.member.nickname == null ? message.author.displayName : message.member.nickname}]: ${msg}`);
    // Relay chat to server
    if (owoState !== "none") {
      msg = owoify(msg, owoState);
    }
    await sendConsoleCommand(`say [${message.member.nickname == null ? message.author.displayName : message.member.nickname}]: ${msg}`);
  }
});

client.login(token);