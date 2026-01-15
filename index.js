const {
  IP,
  port,
  login,
  token,
  chat_channel,
  webhook,
  admins
} = require("./config.json");

const fs = require("fs");
const mineflayer = require("mineflayer");
const movement = require("mineflayer-movement");
const prefix = "!";

const {
  Client,
  GatewayIntentBits,
  Events,
  WebhookClient,
} = require("discord.js");
const { channel } = require("diagnostics_channel");
const { randomInt } = require("crypto");
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const client = new Client({
  intents: [
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.MessageContent,
  ],
});

const WEBHOOK = new WebhookClient(webhook);

let bot;


client.once(Events.ClientReady, async () => {
  console.log("Bot is ready");

  bot = mineflayer.createBot({
    host: IP,
    port: port,
    username: login.email,
    // auth: "microsoft",
    // password: login.password,
  });

  try {
    await client.channels.fetch(chat_channel);
  } catch {
    console.error("Invalid Discord channel ID:", chat_channel);
    return;
  }
  console.log("Connected to Discord channel:", chat_channel);
  setup(bot);
});


client.on("messageCreate", async (message) => {
  const regex = /(\r\n|\n|\r)/gmiu
  message.content = message.content.replace(regex, ' ')
  message.content = message.content.replace(/[\u{0080}-\u{FFFF}]/gu, " ");
  message.content = message.content.replace(/[^\x20-\x7E\n]/gmiu, " ")
  message.content = message.content.replace(/[^$]\n/gmiu, " ")
  message.content = message.content.substring(0, 100)
  message.content = message.content.replace(/(.{255})..+/, "$1")
  if(message.content.includes('{') || message.content.includes('}') || message.content.includes('$')) {
    message.content = message.content.replace('{', "UwU")
    message.content = message.content.replace('}', ":3")
    message.content = message.content.replace('$', "OwO")
    }
  if (message.channel.id !== chat_channel) return;
  if (message.author.bot) return;
  else if (
    admins.includes(message.author.id) &&
    message.content.startsWith("!!")
  ) {
    let msg = message.content.slice(2);
    bot.chat(`${msg}`);
  } 
  else if (message.content.startsWith("!")) {
    let command = message.content.slice(1).toLowerCase();
    if (command === "help") {
    WEBHOOK.send({
      username: bot.username,
      avatarURL: `https://minotar.net/avatar/${bot.username}`,
      content: `!help - Shows this message \n!ping - Shows bot ping \n!position - Shows bot position \n!players - Shows online players`,
    });
    }
    if (command === "players") {
      const onlinePlayers = Object.values(bot.players)
        .filter(p => p && p.username)
        .map(p => p.username)
        
      WEBHOOK.send({
        username: bot.username,
        avatarURL: `https://minotar.net/avatar/${bot.username}`,
        content: `Online players: ${onlinePlayers.length ? onlinePlayers.join(", ").replace(bot.username, `${bot.username} (Bot)`) : "None"}`
      });
    }
    if (command === "ping") {
      WEBHOOK.send({
        username: bot.username,
        avatarURL: `https://minotar.net/avatar/${bot.username}`,
        content: `Pong! My ping is ${bot.player.ping}ms`,
      });
    }
    if (command === "quit" && admins.includes(message.author.id)) {
      bot.end();
    }
    if (command === "restart" && admins.includes(message.author.id)) {
      bot.end();
      setup(bot);
    }
    if (command === "join" && admins.includes(message.author.id) && bot.health <= 0) {
      setup(bot);
    }
    if (command === "position") {
      const position = bot.player.entity.position;
      WEBHOOK.send({
        username: bot.username,
        avatarURL: `https://minotar.net/avatar/${bot.username}`,
        content: `My current position is X: ${position.x.toFixed(0)}, Y: ${position.y.toFixed(0)}, Z: ${position.z.toFixed(0)} in ${bot.world.dimension}`,
      });
    }
  }
  else {
    bot.chat(`[${message.member.nickname == null ? message.author.displayName : message.member.nickname}]: ${message.content}`);


  }
});

client.login(token);

commands = {
  help: (message, username) => {
    bot.chat(`[${username}]: !help - Shows this message`);
    bot.chat(`[${username}]: !ping - Shows bot ping`);
    bot.chat(`[${username}]: !position - Shows bot position`);
  },
  ping: (message, username) => {
    bot.chat(
      `[${username}]: Pong! My ping is ${bot.player.ping}ms`
    )
  },
  position: (message, username) => {
    const position = bot.player.entity.position;
    bot.chat(
      `[${username}]: My current position is X: ${position.x.toFixed(0)}, Y: ${position.y.toFixed(0)}, Z: ${position.z.toFixed(0)} in ${bot.world.dimension}`
    )
  },
};
function sleeps(time) {
  return new Promise(resolve => {
      setTimeout(resolve, time);
  });
}

async function setup(bot) {
  bot.loadPlugin(movement.plugin);

  bot.on("message", async (message) => {
    // let username, messageContent = null;
    
    [username, messageContent] = filter(message);
    if (!message.translate?.includes('commands.message') && username != bot.username) {
      if (messageContent.startsWith(prefix)) {
        try {
          commands[messageContent.slice(prefix.length).split(" ")[0]](messageContent, username);
        } catch {}
      }
      if (username == "Server" && (messageContent.includes("joined the game") || messageContent.includes("left the game"))) {
        updateChannelWithServerStats();
        console.log("Updated server stats due to player join/leave");
      }

      await WEBHOOK.send({
          username: username,
          avatarURL: username == "Server" ? `https://www.freeiconspng.com/download/40686` /*Minecraft Server Icon Download Vectors Free*/ : `https://minotar.net/avatar/${username}`,
          content: messageContent,
          flags: [ 4096 ],
        });
    }
  });


bot.on("spawn", () => {
  console.log("Bot has spawned"); 
  updateChannelWithServerStats();
});
bot.on("time", () => {
  // every noon or midnight update stats
  bot.time.timeOfDay == (6005 || 18015) ? updateChannelWithServerStats() : null;
});

bot.on("soundEffectHeard", (soundName) => {
  if (soundName == "ambient.cave") {
    console.log("updating stats because SPOOKY NOISE!");
    randomInt(1, 100) > 80 ? bot.chat('AHH! I heard something!') : null;
    randomInt(1, 100) > 90 ? WEBHOOK.send({
      username: bot.username,
      avatarURL: `https://minotar.net/avatar/${bot.username}`,
      content: `Did you hear something!?`,
      flags: [ 4096 ],
    }) : null;
    updateChannelWithServerStats();
  }
});

bot.on("end", (reason) => {
  console.log(reason);
  WEBHOOK.send({
    username: 'KickErrorMessage',
    avatarURL: `https://minotar.net/avatar/${bot.username}`,
    content: (reason),
  });
  process.exit(0) 

});

function filter(message) {

  message = message.toString();

  const match = message.match(/^[*<]\s*([\w\d]{1,16})>?\s*(.*)/s);
  let username = null;
  let content = message;

  if (match) {
    username = match[1];   
    content  = match[2];  
  } else {
    username = "Server";
    content = message;
  }
  


  message = message.replaceAll(
    "/((?:https?://)?(?:www.)?[-a-zA-Z0-9@:%._+~#=]{1,256}.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&//=]*))/g",
    "<$1>"
  );
  message = message.trim();
  return [username, content];
}}


/**
 * Updates this text channel's topic with Mineflayer stats
 * @param {import('discord.js').TextChannel} channel
 */
async function updateChannelWithServerStats() {
  try {
    console.log("Updating stats channel topic...");
    const chatChannel = await client.channels.fetch(chat_channel);

    // MINEFLAYER STATS
    // bot.players is a map of all current online players
    await sleeps(6969); // give it a nice moment to update
    const playersMap = bot.players;
    const playersOnline = Object.values(playersMap).filter(p => p && p.username).length; 
    const playerNames = Object.values(playersMap)
      .map(p => p?.username)
      .filter(Boolean);
    const ping = bot.player.ping ?? null;
    const gameTime = await ticksToTime(bot.time.timeOfDay);

    let topic = `Online: ${playersOnline - 1 }`;
    if (playersOnline) {
      topic += ` | Players: ${playerNames.join(", ").replace(bot.username, `${bot.username} (Bot)`)}`;
    }
    if (ping !== null) {
      topic += ` | Bot Ping: ${ping}ms`;
    }
    if (gameTime !== null) {
      topic += ` | Game Time: ${gameTime}`;
    }
    console.log("Generated topic:", topic);
    // Update the channel topic
    chatChannel.setTopic(topic);
    console.log(`Updated channel topic to: ${topic}`);
  } catch (err) {
    console.error("Failed to update stats channel topic:", err);
  }
}

async function ticksToTime(ticks) {
  // Ensure ticks stay within one day
  ticks = ((ticks % 24000) + 24000) % 24000;

  // Convert ticks to minutes
  const totalMinutes = (ticks * 24 * 60) / 24000;

  // Minecraft day starts at 6:00
  let minutes = totalMinutes + 6 * 60;

  // Wrap around 24h
  minutes %= 1440;

  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  try {
  return await `${hours.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}`;
  } catch (err) {
    console.error(err);
  }
}