const {
  IP,
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
    port: 25568,
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
    if (command === "position") {
      const position = bot.player.entity.position;
      WEBHOOK.send({
        username: bot.username,
        avatarURL: `https://minotar.net/avatar/${bot.username}`,
        content: `My current position is X: ${position.x.toFixed(0)}, Y: ${position.y.toFixed(0)}, Z: ${position.z.toFixed(0)}`,
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
      `[${username}]: My current position is X: ${position.x.toFixed(0)}, Y: ${position.y.toFixed(0)}, Z: ${position.z.toFixed(0)}`
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

  bot.once("login", function init() {
    
    // WEBHOOK.send({
    //   username: bot.username,
    //   content: `Logged in at: ${position}`,
    // });
    // const { Default } = bot.movement.goals;
    // bot.movement.setGoal(Default);
    
  });
  bot.once("spawn", () => {
    console.log("Minecraft Bot is ready");
    // position = bot.player.entity.position
    // WEBHOOK.send({
    //   username: bot.username,
    //   avatarURL: `https://minotar.net/avatar/${bot.username}`,
    //   content: `Logged in at: ${position.x.toFixed(0)}, ${position.y.toFixed(0)}, ${position.z.toFixed(0)}`,
    // });
    // bot.on("physicsTick", function tick() {
    //   const entity = bot.nearestEntity((entity) => entity.type === "player");
    //   if (entity) {
    //     // Convert the entity username to lowercase for case-insensitive comparison
    //     const lowercaseEntityUsername = entity.username.toLowerCase();
  
    //     // Convert the names in the players array to lowercase for comparison
    //     const lowercasedPlayers = players.map(player => player.toLowerCase());
  
    //     if (lowercasedPlayers.includes(lowercaseEntityUsername)) {
    //       bot.movement.heuristic.get("proximity").target(entity.position);
    //       const yaw = bot.movement.getYaw(240, 15, 1);
    //       bot.movement.steer(yaw);
    //     }
    //   }
    // });
  });
  // bot.on("chat", async (username, message) => {
  //   if (username != bot.username) {
  //     // message = filter(message);

      // await WEBHOOK.send({
      //   username: username,
      //   avatarURL: `https://minotar.net/avatar/${username}`,
      //   content: message,
      //   flags: [ 4096 ],
      // });
  //   }
  // });
  bot.on("message", async (message) => {
    // let username, messageContent = null;
    
    [username, messageContent] = filter(message);
    if (!message.translate?.includes('commands.message') && username != bot.username) {
      if (messageContent.startsWith(prefix)) {
        try {
          commands[messageContent.slice(prefix.length).split(" ")[0]](messageContent, username);
        } catch {}
      }
      await WEBHOOK.send({
          username: username,
          avatarURL: username == "Server" ? `https://www.freeiconspng.com/download/40686` /*Minecraft Server Icon Download Vectors Free*/ : `https://minotar.net/avatar/${username}`,
          content: messageContent,
          flags: [ 4096 ],
        });
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
    username = match[1];   // ✅ capture group 1
    content  = match[2];   // rest of the message
  } else {
    username = "Server";
    content = message;
  }
  

  // message = message.replaceAll("~", "\\~");
  // message = message.replaceAll("*", "\\*");
  message = message.replaceAll(
    "/((?:https?://)?(?:www.)?[-a-zA-Z0-9@:%._+~#=]{1,256}.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&//=]*))/g",
    "<$1>"
  );
  message = message.trim();
  return [username, content];
}}
