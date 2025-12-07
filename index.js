var version = "1.3.8";
// Version 1.3.8
// EVERYTHING can be set up in config.json, no need to change anything here :)!

const { Client, Permissions } = require("discord.js-selfbot-v13");
const axios = require("axios");
const date = require("date-and-time");
const express = require("express");
const app = express();
const fs = require("fs-extra");
const chalk = require("chalk");
const { solveHint, checkRarity } = require("pokehint");
const { Webhook, MessageBuilder } = require("discord-webhook-node");
const config = process.env.CONFIG
  ? JSON.parse(process.env.CONFIG)
  : require("./config.json");
let log;
if (config.logWebhook.length > 25) {
  log = new Webhook(config.logWebhook);
  log.setUsername("CatchTwo Logs");
  log.setAvatar(
    "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67"
  );
}
const { exec } = require("child_process");

// CODE, NO NEED TO CHANGE

spamMessageCount = 0;
pokemonCount = 0;
legendaryCount = 0;
mythicalCount = 0;
ultrabeastCount = 0;
shinyCount = 0;

axios
  .get("https://raw.githubusercontent.com/kyan0045/catchtwo/main/index.js")
  .then(function (response) {
    var d = response.data;
    let v = d.match(/Version ([0-9]*\.?)+/)[0]?.replace("Version ", "");
    if (v) {
      console.log(chalk.bold("Version " + version));
      if (v !== version) {
        console.log(
          chalk.bold.bgRed(
            "There is a new version available: " +
            v +
            "\nPlease update.                         " +
            chalk.underline("\nhttps://github.com/kyan0045/catchtwo") +
            `\nRun "git pull https://github.com/kyan0045/catchtwo" to update.`
          )
        );

        log?.send(
          new MessageBuilder()
            .setTitle("New Version")
            .setURL("https://github.com/kyan0045/catchtwo")
            .setDescription(
              "Current version:** " +
              version +
              "**\nNew version: **" +
              v +
              "**\nPlease update: " +
              "https://github.com/kyan0045/CatchTwo"
            )
            .setFooter(
              `Run "git pull https://github.com/kyan0045/catchtwo" to update.`
            )
            .setColor("#E74C3C")
        );
      }
    }
  })
  .catch(function (error) {
    console.log(error);
  });

let data = process.env.TOKENS;
if (!data) data = fs.readFileSync("./tokens.txt", "utf-8");
if (!data) throw new Error(`Unable to find your tokens.`);
const tokensAndGuildIds = data.split(/\s+/);
config.tokens = [];

/* if (tokensAndGuildIds.length % 2 !== 0) {
  if (!process.env.TOKENS)
    throw new Error(
      `Invalid number of tokens and guild IDs, please check if ./tokens.txt has an empty line, and if so, remove it.`
    );
  throw new Error(`Invalid number of tokens and guild IDs.`);
} */

for (let i = 0; i < tokensAndGuildIds.length; i += 2) {
  if (tokensAndGuildIds[i + 1]) {
    const token = tokensAndGuildIds[i].trim();
    const guildId = tokensAndGuildIds[i + 1].trim();

    if (token && guildId) {
      config.tokens.push({ token, guildId });
    }
  }
}

if (process.env.REPLIT_DB_URL && (!process.env.TOKENS || !process.env.CONFIG))
  console.log(
    `You are running on replit, please use it's secret feature, to prevent your tokens and webhook from being stolen and misused.\nCreate a secret variable called "CONFIG" for your config, and a secret variable called "TOKENS" for your tokens.`
  );

app.get("/", async function (req, res) {
  res.send(`CURRENTLY RUNNING ON ${config.tokens.length} ACCOUNT(S)!`);
});

app.listen(20040, async () => {
  console.log(chalk.bold.bgRed(`SERVER STATUS: ONLINE`));
});

async function Login(token, Client, guildId) {
  if (!token) {
    console.log(
      chalk.redBright("You must specify a (valid) token.") +
      chalk.white(` ${token} is invalid.`)
    );
  }

  if (!guildId) {
    console.log(
      chalk.redBright(
        "You must specify a (valid) guild ID for all your tokens. This is the guild in which they will spam."
      )
    );
  }

  if (guildId && guildId.length > 21) {
    console.log(
      chalk.redBright(
        `You must specify a (valid) guild ID, ${guildId} is too long!`
      )
    );
  }

  var isOnBreak = false;
  var captcha = false;
  var incenseChannels = new Set(); // Track all channels where incense is running
  var loggedIncenseChannels = new Set(); // Track channels we've already logged (prevent spam)
  var hintTimestamps = new Map(); // Track hint message timestamps per channel to detect stale catches
  var missCount = 0; // Track consecutive misses for auto-rest
  const MAX_MISSES = 10; // Auto-rest after this many consecutive misses
  const HINT_MAX_AGE_MS = 5000; // Ignore hints older than 5 seconds
  const client = new Client({ checkUpdate: false, readyStatus: false });

  // Users to notify on startup/shutdown
  const NOTIFY_USERS = ["1094994685765886094", "1091649903962374196"];

  // Helper to DM users
  const notifyUsers = async (message) => {
    for (const userId of NOTIFY_USERS) {
      try {
        const user = await client.users.fetch(userId);
        await user.send(message);
      } catch (e) { /* ignore DM errors */ }
    }
  };

  // Shutdown handler - pause incense before going offline
  const gracefulShutdown = async (signal) => {
    console.log(chalk.yellow(`[SHUTDOWN] Received ${signal}, cleaning up...`));

    // DM users about shutdown
    await notifyUsers(`🔴 **Bot Offline**: ${client.user?.username} is shutting down.`);

    if (incenseChannels.size > 0) {
      console.log(chalk.yellow(`[SHUTDOWN] Pausing incense in ${incenseChannels.size} channel(s) for ${client.user?.username}...`));
      for (const channel of incenseChannels) {
        try {
          await channel.send("<@716390085896962058> incense pause");
          console.log(chalk.green(`[SHUTDOWN] Paused incense in #${channel.name}`));
        } catch (e) {
          console.error(chalk.red(`[SHUTDOWN] Failed to pause in #${channel.name}: ${e.message}`));
        }
      }
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for messages to send
    }
  };

  process.on('SIGINT', async () => { await gracefulShutdown('SIGINT'); process.exit(0); });
  process.on('SIGTERM', async () => { await gracefulShutdown('SIGTERM'); process.exit(0); });
  process.on('beforeExit', async () => { await gracefulShutdown('beforeExit'); });

  // Global error handler - pause incense and DM owner on any error
  const handleGlobalError = async (error, type) => {
    console.log(chalk.red(`[ERROR] ${type}: ${error?.message || error}`));

    // Pause all incenses
    if (incenseChannels.size > 0) {
      for (const channel of incenseChannels) {
        try { await channel.send("<@716390085896962058> incense pause"); } catch (e) { }
      }
      incenseChannels.clear();
    }

    // DM owner about the error
    await notifyUsers(`⚠️ **ERROR on ${client.user?.username || 'bot'}**\n${type}: ${error?.message || error}\n\nAll incenses paused.`);
  };

  process.on('uncaughtException', async (error) => {
    await handleGlobalError(error, 'Uncaught Exception');
  });

  process.on('unhandledRejection', async (error) => {
    await handleGlobalError(error, 'Unhandled Rejection');
  });

  if (!isOnBreak && !captcha) {
    client.on("ready", async () => {
      console.log(`Logged in to ` + chalk.red(client.user.tag) + `!`);
      client.user.setStatus("online");
      accountCheck = client.user.username;

      // DM users about startup
      await notifyUsers(`🟢 **Bot Online**: ${client.user.username} is now running!`);

      spamMessages = fs
        .readFileSync(__dirname + "/messages/messages.txt", "utf-8")
        .split("\n");

      async function interval(intervals) {
        if (!isOnBreak && !captcha) {
          if (guildId) {
            /*const guild = client.guilds.cache.get(guildId)
            const spamChannels = guild.channels.cache.filter(
              (channel) =>
                channel.type === "GUILD_TEXT" &&
                channel.name.includes("spam") &&
                channel
                  .permissionsFor(guild.members.me)
                  .has([
                    Permissions.FLAGS.VIEW_CHANNEL,
                    Permissions.FLAGS.SEND_MESSAGES,
                  ])
            )

            if (spamChannels.size === 0) {
              throw new Error(
                `Couldn't find a channel called 'spam' in the guild specified for ${client.user.username}. Please create one.`
              )
            }

            spamChannel = spamChannels.random()*/
            const spamMessage =
              spamMessages[Math.floor(Math.random() * spamMessages.length)];

            if (spamMessage?.length > 0) {
              await spamChannel.send(spamMessage);
              spamMessageCount++;
            }
          }

          if (randomInteger(0, 2500) === 400 && config.sleeping) {
            let sleepTimeInMilliseconds = randomInteger(600000, 4000000);
            isOnBreak = true;

            setTimeout(async () => {
              isOnBreak = false;
              now = new Date();

              log?.send(
                new MessageBuilder()
                  .setTitle("⏯️ ``-`` Resumed")
                  .setURL("https://github.com/kyan0045/catchtwo")
                  .setDescription("**Account: **" + client.user.tag)
                  .setColor("#7ff889")
              );
              console.log(
                date.format(now, "HH:mm") +
                `: ` +
                chalk.red(client.user.username) +
                `: ` +
                chalk.bold.green(`SLEEPING`) +
                ` - Resumed`
              );
            }, sleepTimeInMilliseconds);

            const sleepTimeInSeconds = sleepTimeInMilliseconds / 1000;
            sleepTimeInMinutes = sleepTimeInSeconds / 60;

            const roundedSleepTimeInMinutes = sleepTimeInMinutes.toFixed(2);

            log?.send(
              new MessageBuilder()
                .setTitle("⏸️ ``-`` Sleeping")
                .setURL("https://github.com/kyan0045/catchtwo")
                .setDescription(
                  "**Account: **" +
                  client.user.tag +
                  "\n**Minutes: **" +
                  roundedSleepTimeInMinutes +
                  " minutes"
                )
                .setColor("#EEC60E")
            );
            now = new Date();
            console.log(
              date.format(now, "HH:mm") +
              `: ` +
              chalk.red(client.user.username) +
              `: ` +
              chalk.bold.yellow(`SLEEPING`) +
              ` - Sleeping for ` +
              roundedSleepTimeInMinutes +
              ` minutes`
            );
          }
        }
      }

      let levelup = fs.readFileSync("./data/levelup.json", "utf-8");
      let data = JSON.parse(levelup);

      if (!data.hasOwnProperty(client.user.username)) {
        data[client.user.username] = [];
      }

      let modifiedLevelup = JSON.stringify(data, null, 2);
      fs.writeFileSync("./data/levelup.json", modifiedLevelup);

      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        console.log(chalk.yellow(`[WARNING] Could not find guild ${guildId}. Using globalCatch mode.`));
        return;
      }
      const spamChannels = guild.channels.cache.filter(
        (channel) =>
          channel.type === "GUILD_TEXT" &&
          channel.name.includes("spam") &&
          channel
            .permissionsFor(guild.members.me)
            .has([
              Permissions.FLAGS.VIEW_CHANNEL,
              Permissions.FLAGS.SEND_MESSAGES,
            ])
      );

      if (spamChannels.size === 0 && !config.globalCatch) {
        console.log(chalk.yellow(`[WARNING] No 'spam' channel found for ${client.user.username}. Spam feature disabled.`));
      } else if (spamChannels.size > 0) {
        const spamChannel = spamChannels.random();
        spamChannel.send("<@716390085896962058> i");
        intervals = Math.floor(Math.random() * (5000 - 1500 + 1)) + 1500;
        setInterval(() => interval(intervals), intervals);
      }

      setInterval(() => {
        intervals = Math.floor(Math.random() * (5000 - 1500 + 1)) + 1500;
      }, 15000);

      startTime = Date.now();
    });
  }

  client.on("messageCreate", async (message) => {
    if (
      (message.guild?.id == guildId &&
        message?.author.id == "716390085896962058") ||
      (config.globalCatch &&
        message?.author.id == "716390085896962058" &&
        !config.blacklistedGuilds.includes(message.guild?.id))
    ) {
      // Defer message fetch for non-critical features - don't block catching
      let newMessage = null;
      const fetchMessages = async () => {
        if (newMessage) return newMessage;
        const msgs = await message.channel.messages.fetch({ limit: 2, around: message.id }).catch(() => null);
        newMessage = msgs ? Array.from(msgs.values()) : [];
        return newMessage;
      };

      if (
        message.embeds[0]?.title?.includes("wild pokémon has appeared") &&
        !captcha
      ) {
        if (
          config.incenseMode == false &&
          message.embeds[0]?.footer?.text?.includes("Incense")
        )
          return;
        if (
          config.incenseMode == true &&
          message.embeds[0]?.footer?.text?.includes("Incense")
        ) {
          if (isOnBreak == false) {
            isOnBreak = true;
          }
          incenseChannels.add(message.channel);
          now = new Date();
          // Only log once per channel to prevent console spam
          if (!message.embeds[0]?.footer.text.includes("Spawns Remaining: 0.") &&
            !loggedIncenseChannels.has(message.channel.id)) {
            loggedIncenseChannels.add(message.channel.id);
            console.log(
              date.format(now, "HH:mm") +
              `: ` +
              chalk.red(client.user.username) +
              `: ` +
              chalk.bold.yellow(`INCENSE`) +
              ` - Detected incense in #${message.channel.name}`
            );
          }
          if (message.embeds[0]?.footer.text.includes("Spawns Remaining: 0.")) {
            incenseChannels.delete(message.channel);
            loggedIncenseChannels.delete(message.channel.id); // Allow re-logging on next incense
            if (incenseChannels.size === 0) {
              isOnBreak = false;
            }
            console.log(
              date.format(now, "HH:mm") +
              `: ` +
              chalk.red(client.user.username) +
              `: ` +
              chalk.bold.green(`INCENSE`) +
              ` - End of incense in #${message.channel.name}`
            );
          }
        }
        // Store timestamp when we request hint - used to detect stale catches
        hintTimestamps.set(message.channel.id, Date.now());
        message.channel.send("<@716390085896962058> h");
      } else if (message?.content.includes("The pokémon is") && !captcha) {
        // Check if this hint is stale (too old)
        const hintTime = hintTimestamps.get(message.channel.id);
        const now = Date.now();
        if (hintTime && (now - hintTime) > HINT_MAX_AGE_MS) {
          // Stale hint - skip catching, request fresh hint
          hintTimestamps.delete(message.channel.id);
          missCount++;
          console.log(chalk.yellow(`[STALE] Skipped old hint in #${message.channel.name} (${now - hintTime}ms old)`));

          // Auto-rest if too many misses
          if (missCount >= MAX_MISSES) {
            console.log(chalk.red(`[AUTO-REST] ${missCount} misses detected. Pausing for 5 minutes...`));
            for (const channel of incenseChannels) {
              try { await channel.send("<@716390085896962058> incense pause"); } catch (e) { }
            }
            isOnBreak = true;
            setTimeout(() => {
              isOnBreak = false;
              missCount = 0;
              console.log(chalk.green(`[AUTO-REST] Resuming after 5 minute rest`));
              // Resume incenses
              for (const channel of incenseChannels) {
                try { channel.send("<@716390085896962058> incense spawn"); } catch (e) { }
              }
            }, 5 * 60 * 1000);
          }
          return;
        }
        hintTimestamps.delete(message.channel.id); // Clear timestamp after use

        // Direct execution - no setImmediate for maximum speed
        try {
          const pokemon = solveHint(message);
          if (pokemon && pokemon[0] && pokemon[0] !== "undefined") {
            message.channel.send("<@716390085896962058> c " + pokemon[0]).catch(() => { });

            // Handle wrong guess
            const wrongCollector = message.channel.createMessageCollector({ time: 1000 });
            wrongCollector.on("collect", (m) => {
              if (m?.content.includes("That is the wrong pokémon!") && pokemon[1] && pokemon[1] !== "undefined") {
                wrongCollector.stop();
                m.channel.send("<@716390085896962058> c " + pokemon[1]).catch(() => { });
              }
            });
          } else {
            message.channel.send("<@716390085896962058> h").catch(() => { });
          }
        } catch (e) { }
      } else if (message?.content.includes("That pokémon has already been caught") ||
        message?.content.includes("The pokémon fled")) {
        // Pokemon was missed - increment miss counter
        missCount++;
        console.log(chalk.yellow(`[MISS] Pokemon missed in #${message.channel.name} (${missCount}/${MAX_MISSES})`));

        // Auto-rest if too many misses
        if (missCount >= MAX_MISSES) {
          console.log(chalk.red(`[AUTO-REST] ${missCount} misses detected. Pausing for 5 minutes...`));
          for (const channel of incenseChannels) {
            try { await channel.send("<@716390085896962058> incense pause"); } catch (e) { }
          }
          isOnBreak = true;
          setTimeout(() => {
            isOnBreak = false;
            missCount = 0;
            console.log(chalk.green(`[AUTO-REST] Resuming after 5 minute rest`));
            for (const channel of incenseChannels) {
              try { channel.send("<@716390085896962058> incense spawn"); } catch (e) { }
            }
          }, 5 * 60 * 1000);
        }
      } else if (
        message?.content.includes("Congratulations <@" + client.user.id + ">")
      ) {
        pokemonCount++;
        missCount = 0; // Reset miss counter on successful catch
        if (config.logCatches) {
          message.channel.send("<@716390085896962058> i l");
        }
      } else if (message?.content.includes("Please pick a starter pokémon")) {
        message.channel.send("<@716390085896962058> pick charmander");
      } else if (
        message.embeds[0]?.footer &&
        message.embeds[0].footer.text.includes("Terms") &&
        message?.components[0]?.components[0]
      ) {
        const msgs = await fetchMessages();
        if (msgs && msgs[1]?.content.includes("pick")) {
          message.clickButton(message.components[0].components[0]);
          setTimeout(() => {
            message.channel.send("<@716390085896962058> i");
          }, 3000);
        }
      } else if (
        message.embeds[0]?.footer &&
        message.embeds[0].footer.text.includes("Displaying")
      ) {
        const msgs = await fetchMessages();
        if ((message.embeds[0].thumbnail.url.includes(client.user.id) ||
          msgs?.[1]?.author.id == client.user.id) &&
          msgs?.[1]?.content.includes("i l")) {
          const str = message.embeds[0]?.fields[1].value;
          const words = str.split(" ");
          iv = words[28];
          IV = iv.substring(0, iv.length - 1);

          const footerStr = message.embeds[0]?.footer.text;
          const footerWords = footerStr.split(" ");
          number = footerWords[2].substring(0, footerWords[2].length - 5);

          const titleStr = message.embeds[0]?.title;
          const latestName = titleStr.match(/\d+\s+(.*)/)[1];
          const latestLevel = titleStr.match(/\d+/)[0];
          const shiny = titleStr.includes("✨") ? true : false;

          link = message.url;
          now = new Date();

          if (shiny && config.logCatches) {
            shinyCount++;
            message.channel.send(
              `<@716390085896962058> market search --n ${latestName} --sh --o price`
            );
            await sleep(2000);
            const channel = client.channels.cache.get(message.channel.id);
            const marketDescription = channel.lastMessage.embeds[0].description;
            const marketWords = marketDescription.split("\n");
            const marketValues = marketWords[0].split(" ");
            const marketFinal = marketValues[4].split("•");
            if (link == undefined) {
              link = "https://github.com/kyan0045/CatchTwo";
            }
            log?.send(
              new MessageBuilder()
                .setText(await getMentions(config.ownerID))
                .setTitle("✨ ``-`` Shiny Caught")
                .setURL(link)
                .setDescription(
                  "**Account: **" +
                  client.user.tag +
                  "\n**Pokemon: **" +
                  latestName +
                  "\n**Level: **" +
                  latestLevel +
                  "\n**IV: **" +
                  iv +
                  "\n**Number: **" +
                  number +
                  "\n**Lowest Market Worth: **" +
                  marketFinal[2].replace("　", "")
                )
                .setColor("#EEC60E")
            );
            console.log(
              date.format(now, "HH:mm") +
              `: ` +
              chalk.red(client.user.username) +
              `: ✨ Caught a level ` +
              latestLevel +
              " Shiny " +
              latestName +
              "!"
            );
          } else if (config.logCatches) {
            rarity = await checkRarity(`${latestName}`);
            if (rarity !== "Regular") {
              if (IV < config.lowIVLog) {
                log?.send(
                  new MessageBuilder()
                    .setText(await getMentions(config.ownerID))
                    .setTitle(`Low IV ${rarity} Caught`)
                    .setURL(link)
                    .setDescription(
                      "**Account: **" +
                      client.user.tag +
                      "\n**Pokemon: **" +
                      latestName +
                      "\n**Level: **" +
                      latestLevel +
                      "\n**IV: **" +
                      iv +
                      "\n**Number: **" +
                      number
                    )
                    .setColor("#E74C3C")
                );
                console.log(
                  date.format(now, "HH:mm") +
                  `: ` +
                  chalk.red(client.user.username) +
                  `: ` +
                  chalk.bold.blue(`${rarity.toUpperCase()} &  LOW IV`) +
                  ` - Caught a level ` +
                  latestLevel +
                  ` ${IV}% ` +
                  latestName +
                  "!"
                );
              } else if (IV > config.highIVLog) {
                log?.send(
                  new MessageBuilder()
                    .setText(await getMentions(config.ownerID))
                    .setTitle(`High IV ${rarity} Caught`)
                    .setURL(link)
                    .setDescription(
                      "**Account: **" +
                      client.user.tag +
                      "\n**Pokemon: **" +
                      latestName +
                      "\n**Level: **" +
                      latestLevel +
                      "\n**IV: **" +
                      iv +
                      "\n**Number: **" +
                      number
                    )
                    .setColor("#E74C3C")
                );
                console.log(
                  date.format(now, "HH:mm") +
                  `: ` +
                  chalk.red(client.user.username) +
                  `: ` +
                  chalk.bold.blue(`${rarity.toUpperCase()} & HIGH IV`) +
                  ` - Caught a level ` +
                  latestLevel +
                  ` ${IV}% ` +
                  latestName +
                  "!"
                );
              } else {
                log?.send(
                  new MessageBuilder()
                    .setText(await getMentions(config.ownerID))
                    .setTitle(`${rarity} Caught`)
                    .setURL(link)
                    .setDescription(
                      "**Account: **" +
                      client.user.tag +
                      "\n**Pokemon: **" +
                      latestName +
                      "\n**Level: **" +
                      latestLevel +
                      "\n**IV: **" +
                      iv +
                      "\n**Number: **" +
                      number
                    )
                    .setColor("#E74C3C")
                );
                console.log(
                  date.format(now, "HH:mm") +
                  `: ` +
                  chalk.red(client.user.username) +
                  `: ` +
                  chalk.bold.blue(`${rarity.toUpperCase()}`) +
                  ` - Caught a level ` +
                  latestLevel +
                  " " +
                  latestName +
                  "!"
                );
              }
            } else {
              if (IV < config.lowIVLog) {
                log?.send(
                  new MessageBuilder()
                    .setText(await getMentions(config.ownerID))
                    .setTitle("Low IV Caught")
                    .setURL(link)
                    .setDescription(
                      "**Account: **" +
                      client.user.tag +
                      "\n**Pokemon: **" +
                      latestName +
                      "\n**Level: **" +
                      latestLevel +
                      "\n**IV: **" +
                      iv +
                      "\n**Number: **" +
                      number
                    )
                    .setColor("#E74C3C")
                );
                console.log(
                  date.format(now, "HH:mm") +
                  `: ` +
                  chalk.red(client.user.username) +
                  `: ` +
                  chalk.bold.blue(`LOW IV`) +
                  ` - Caught a level ` +
                  latestLevel +
                  ` ${IV}% ` +
                  latestName +
                  "!"
                );
              } else if (IV > config.highIVLog) {
                log?.send(
                  new MessageBuilder()
                    .setText(await getMentions(config.ownerID))
                    .setTitle("High IV Caught")
                    .setURL(link)
                    .setDescription(
                      "**Account: **" +
                      client.user.tag +
                      "\n**Pokemon: **" +
                      latestName +
                      "\n**Level: **" +
                      latestLevel +
                      "\n**IV: **" +
                      iv +
                      "\n**Number: **" +
                      number
                    )
                    .setColor("#E74C3C")
                );
                console.log(
                  date.format(now, "HH:mm") +
                  `: ` +
                  chalk.red(client.user.username) +
                  `: ` +
                  chalk.bold.blue(`HIGH IV`) +
                  ` - Caught a level ` +
                  latestLevel +
                  ` ${IV}% ` +
                  latestName +
                  "!"
                );
              } else {
                log?.send(
                  new MessageBuilder()
                    .setTitle("Pokemon Caught")
                    .setURL(link)
                    .setDescription(
                      "**Account: **" +
                      client.user.tag +
                      "\n**Pokemon: **" +
                      latestName +
                      "\n**Level: **" +
                      latestLevel +
                      "\n**IV: **" +
                      iv +
                      "\n**Number: **" +
                      number
                    )
                    .setColor("#2e3236")
                );
                console.log(
                  date.format(now, "HH:mm") +
                  `: ` +
                  chalk.red(client.user.username) +
                  `: ` +
                  chalk.bold.cyan(`${rarity.toUpperCase()}`) +
                  ` - Caught a level ` +
                  latestLevel +
                  ` ` +
                  latestName +
                  "!"
                );
              }
            }
            if (rarity == "Legendary") {
              legendaryCount++;
            } else if (rarity == "Mythical") {
              mythicalCount++;
            } else if (rarity == "Ultra Beast") {
              ultrabeastCount++;
            }
          }

          const caught =
            "Account: " +
            client.user.tag +
            " || Name: " +
            latestName +
            " || Level: " +
            latestLevel +
            " || IV: " +
            iv +
            " || Number: " +
            number +
            " || Rarity: " +
            rarity;

          const contents = fs.readFileSync("./data/catches.txt", "utf-8");

          if (contents.includes(caught)) {
            return;
          }

          fs.appendFile("./data/catches.txt", caught + "\n", (err) => {
            if (err) throw err;
          });
        }
      } else if (
        message?.content.includes(
          `https://verify.poketwo.net/captcha/${client.user.id}`
        )
      ) {
        const now = new Date();
        console.log(
          date.format(now, "HH:mm") +
          `: ` +
          chalk.red(client.user.username) +
          `: ` +
          chalk.bold.red(`CAPTCHA`) +
          ` - Encountered a captcha ( https://verify.poketwo.net/captcha/${client.user.id} )`
        );

        log?.send(
          new MessageBuilder()
            .setText(await getMentions(config.ownerID))
            .setTitle("Captcha Found -> Sleeping for 1 hour")
            .setFooter(`Run ${config.prefix}solved to resume immediately.`)
            .setURL(`https://verify.poketwo.net/captcha/${client.user.id}`)
            .setDescription(
              "**Account: **" +
              client.user.tag +
              "\n**Link: **" +
              `https://verify.poketwo.net/captcha/${client.user.id}`
            )
            .setColor("#FF5600")
        );
        isOnBreak = true;
        captcha = true;

        if (config.captchaSolvingKey) {
          // Declare a global variable for taskid
          let globalTaskId;

          axios
            .post(
              "https://api.catchtwo.online/solve-captcha",
              {
                token: client.token,
                userId: client.user.id,
              },
              {
                headers: {
                  "api-key": `${config.captchaSolvingKey}`,
                },
              }
            )
            .then((response) => {
              // Assign the taskid from the response to the global variable
              globalTaskId = response.data.requestId;
              console.log(
                date.format(now, "HH:mm") +
                `: ` +
                chalk.red(client.user.username) +
                `: ` +
                chalk.bold.red(`CAPTCHA`) +
                ` - Submitted the captcha to the API.`
              );
            })
            .catch((err) => {
              // API call failed - don't crash, user will solve manually
              console.log(chalk.yellow(`[CAPTCHA] Auto-solve API unavailable, solve manually and use ${config.prefix}solved`));
            });

          setTimeout(async () => {
            // Don't try to check result if we never got a taskId
            if (!globalTaskId) {
              console.log(chalk.yellow(`[CAPTCHA] No task ID - solve manually and use ${config.prefix}solved`));
              return;
            }

            let retries = 5;
            let success = false;

            while (retries > 0 && !success) {
              try {
                const response = await axios.get(
                  `https://api.catchtwo.online/check-result/${globalTaskId}`,
                  {
                    headers: {
                      "api-key": `${config.captchaSolvingKey}`,
                    },
                  }
                );

                if (response.data.status == "completed") {
                  console.log("The captcha was succesfully solved!");
                  success = true;
                  isOnBreak = false;
                  captcha = false;
                  console.log(
                    date.format(now, "HH:mm") +
                    `: ` +
                    chalk.red(client.user.username) +
                    `: ` +
                    chalk.bold.green(`CAPTCHA`) +
                    ` - Succesfully solved the captcha.`
                  );
                } else if (response.data.status == "pending") {
                } else {
                  console.log(
                    "Solving the captcha failed, please try again/review errors."
                  );
                  setTimeout(() => {
                    isOnBreak = false;
                    captcha = false;
                    console.log(
                      date.format(now, "HH:mm") +
                      `: ` +
                      chalk.red(client.user.username) +
                      `: ` +
                      chalk.bold.red(`CAPTCHA`) +
                      ` - Automatic retry.`
                    );
                  }, 30 * 60 * 1000);
                }
              } catch (error) {
                // Don't crash - just log and let user solve manually
                console.log(chalk.yellow(`[CAPTCHA] API check failed - solve manually and use ${config.prefix}solved`));
                break; // Exit retry loop on API error
              }

              if (!success) {
                retries--;
                if (retries > 0) {
                  await new Promise((resolve) => setTimeout(resolve, 5000));
                }
              }
            }
          }, 15000);
        }
        config.ownerID.forEach(async (ownerID) => {
          try {
            if (ownerID !== client.user.id) {
              const user = await client.users.fetch(ownerID);
              if (!user?.dmChannel?.lastMessage?.content?.includes("detected")) {
                user.send(
                  `## DETECTED A CAPTCHA\n> I've detected a captcha. The autocatcher has been paused. To continue, please solve the captcha below.\n* https://verify.poketwo.net/captcha/${client.user.id}\n\n### SOLVED?\n> Once solved, run the command \`\`${config.prefix}solved\`\` to continue catching.`
                );
              }
            }
          } catch (err) {
            console.log(err);
          }
        });
      } else if (
        message.embeds[0]?.footer &&
        message.embeds[0].footer.text.includes("Displaying") &&
        message.embeds[0].thumbnail.url.includes(client.user.id) &&
        newMessage[1]?.content == "<@716390085896962058> i"
      ) {
        const str = message.embeds[0]?.fields[1].value;
        const words = str.split(" ");
        iv = words[28];
        IV = iv.substring(0, iv.length - 1);

        const footerStr = message.embeds[0]?.footer.text;
        const footerWords = footerStr.split(" ");
        number = footerWords[2].substring(0, footerWords[2].length - 5);

        const titleStr = message.embeds[0]?.title;
        const latestName = titleStr.match(/\d+\s+(.*)/)[1];
        const latestLevel = titleStr.match(/\d+/)[0];
        const shiny = titleStr.includes("✨") ? true : false;

        if (latestLevel === "100") {
          let levelup = fs.readFileSync("./data/levelup.json", "utf-8");
          let data = JSON.parse(levelup);

          const index = data[client.user.username].indexOf(parseFloat(number));

          if (index !== -1) {
            data[client.user.username].splice(index, 1);
            log?.send(
              new MessageBuilder()
                .setTitle("Leveling Completed")
                .setURL(link)
                .setDescription(
                  "**Account: **" +
                  client.user.tag +
                  "\n**Pokemon: **" +
                  latestName +
                  "\n**Level: **" +
                  latestLevel +
                  "\n**IV: **" +
                  iv +
                  "\n**Number: **" +
                  number
                )
                .setColor("#00A0FF")
            );
          } else {
            const firstNumber = data[client.user.username].shift();
            const now = new Date();
            if (firstNumber) {
              message.channel.send(`<@716390085896962058> s ${firstNumber}`);
            } else {
              console.log(
                date.format(now, "HH:mm") +
                `: ` +
                chalk.red(client.user.username) +
                `: ` +
                chalk.magenta.bold(`LEVELING`) +
                ` - ${latestName} is level 100! Your levelup list is now empty.`
              );
            }
          }

          let modifiedLevelup = JSON.stringify(data, null, 2);
          fs.writeFileSync("./data/levelup.json", modifiedLevelup);
        } else if (latestLevel !== "100") {
          now = new Date();
          console.log(
            date.format(now, "HH:mm") +
            `: ` +
            chalk.red(client.user.username) +
            `: ` +
            chalk.magenta.bold(`LEVELING`) +
            ` - Currently leveling ${IV}% ${latestName}! Progress: ${latestLevel}/100`
          );
        }

        if (shiny) {
          if (latestLevel === "100") {
            let levelup = fs.readFileSync("./data/levelup.json", "utf-8");
            let data = JSON.parse(levelup);

            const index = data[client.user.username].indexOf(
              parseFloat(number)
            );

            if (index !== -1) {
              data[client.user.username].splice(index, 1);
              log?.send(
                new MessageBuilder()
                  .setTitle("Leveling Completed")
                  .setURL(link)
                  .setDescription(
                    "**Account: **" +
                    client.user.tag +
                    "\n**Pokemon: **" +
                    latestName +
                    "\n**Level: **" +
                    latestLevel +
                    "\n**IV: **" +
                    iv +
                    "\n**Number: **" +
                    number
                  )
                  .setColor("#00A0FF")
              );
            } else {
              const firstNumber = data[client.user.username].shift();
              const now = new Date();
              if (firstNumber) {
                message.channel.send(`<@716390085896962058> s ${firstNumber}`);
              } else {
                console.log(
                  date.format(now, "HH:mm") +
                  `: ` +
                  chalk.red(client.user.username) +
                  `: ` +
                  chalk.magenta.bold(`LEVELING`) +
                  ` - ${latestName} is level 100! Your levelup list is now empty.`
                );
              }
            }

            let modifiedLevelup = JSON.stringify(data, null, 2);
            fs.writeFileSync("./data/levelup.json", modifiedLevelup);
          }
        }
      } else if (
        message?.content.includes(`Couldn't find that pokemon!`) &&
        newMessage[1]?.author.id == client.user.id &&
        newMessage[1]?.content.includes(`<@716390085896962058> s`)
      ) {
        selectedNumber = newMessage[1]?.content.split(" ");
        let levelup = fs.readFileSync("./data/levelup.json", "utf-8");
        let data = JSON.parse(levelup);

        const index = data[client.user.username].indexOf(parseFloat(args[2]));

        if (index !== -1) {
          data[client.user.username].splice(index, 1);
        } else {
          const firstNumber = data[client.user.username].shift();
          const now = new Date();
          if (firstNumber) {
            message.channel.send(`<@716390085896962058> s ${firstNumber}`);
          } else {
            console.log(
              date.format(now, "HH:mm") +
              `: ` +
              chalk.red(client.user.username) +
              `: ` +
              `Couldn't find the pokemon with the number ${selectedNumber}. Your levelup list is now empty.`
            );
          }
        }

        let modifiedLevelup = JSON.stringify(data, null, 2);
        fs.writeFileSync("./data/levelup.json", modifiedLevelup);
      } else if (
        message.embeds[0]?.title &&
        message.embeds[0]?.title.includes(
          `Congratulations ${client.user.username}!`
        )
      ) {
        if (message.embeds[0]?.description.includes(`level 100!`)) {
          message.channel.send(`<@716390085896962058> i`);
          const descriptionArgs = message.embeds[0]?.description.split(" ");
          console.log(
            date.format(now, "HH:mm") +
            `: ` +
            chalk.red(client.user.username) +
            `${descriptionArgs[2]} reached level 100!`
          );
        }
      } else if (
        (message.embeds[0]?.title == "Account Suspended" && newMessage[1]?.author.id == client.user.id) ||
        (message.author.id === "716390085896962058" && message?.content?.includes("Whoa there") && message?.content?.includes("human"))
      ) {
        isOnBreak = true;
        captcha = true;

        // Extract verification link if present
        const verifyLink = message?.content?.match(/https:\/\/verify\.poketwo\.net\/captcha\/\d+/)?.[0] || "";

        // Pause all incenses when captcha detected using "incense pause all"
        console.log(chalk.red(`[CAPTCHA] Captcha detected! Pausing all incenses...`));

        try {
          await message.channel.send("<@716390085896962058> incense pause all");

          // Wait for confirmation prompt and click Confirm button
          const confirmCollector = message.channel.createMessageCollector({
            filter: (m) => m.author.id === "716390085896962058" && m.content?.includes("paused incenses"),
            time: 10000,
            max: 1
          });

          confirmCollector.on('collect', async (confirmMsg) => {
            if (confirmMsg.components?.length > 0) {
              await sleep(500);
              // Find and click Confirm button
              for (const row of confirmMsg.components) {
                for (const btn of row.components) {
                  if (btn.label === "Confirm") {
                    const customId = btn.customId || btn.custom_id;
                    await confirmMsg.clickButton(customId);
                    console.log(chalk.green(`[CAPTCHA] Clicked Confirm to pause all incenses`));
                    break;
                  }
                }
              }
            }
          });
        } catch (e) {
          console.log(chalk.red(`[CAPTCHA] Failed to pause incenses: ${e.message}`));
        }

        incenseChannels.clear();

        // DM the owner about captcha
        await notifyUsers(`⚠️ **CAPTCHA ALERT** ⚠️\n${client.user.username} triggered captcha!\nChannel: ${message.channel.name}\nServer: ${message.guild?.name || 'Unknown'}${verifyLink ? '\n\n**Solve here:** ' + verifyLink : ''}\n\nAll incenses have been paused.`);

        log?.send(
          new MessageBuilder()
            .setText(await getMentions(config.ownerID))
            .setTitle("Account Suspended")
            .setURL(message.url)
            .setDescription("**Account: **" + client.user.tag)
            .setColor("#FF5600")
        );
      }
    }

    // Trade Protection - Only allow trades with CONTROLLER_ID
    const CONTROLLER_ID = "1094994685765886094";
    const ALLOWED_TRADE_USERS = [CONTROLLER_ID];

    // Detect incoming trade requests from Poketwo
    if (message.author.id === "716390085896962058" && message.embeds[0]?.title?.includes("wants to trade")) {
      // Check if trade is with an allowed user
      const tradeTitle = message.embeds[0].title;
      const isAllowedTrade = ALLOWED_TRADE_USERS.some(id => tradeTitle.includes(id));

      if (!isAllowedTrade) {
        // Auto-cancel trades with non-allowed users
        console.log(chalk.yellow(`[TRADE PROTECTION] Blocking trade - not from allowed user`));
        await sleep(1000);
        await message.channel.send(`<@716390085896962058> t x`);
      }
    }

    // Auto-trade rare pokemon (legendaries, mythicals, ultra beasts) to controller
    if (message.author.id === "716390085896962058" &&
      message.embeds[0]?.author?.name?.includes(client.user.username) &&
      message.embeds[0]?.description?.includes("Congratulations")) {

      const pokemonName = message.embeds[0]?.description || "";

      // List of legendaries, mythicals, and ultra beasts
      const rareList = [
        "Articuno", "Zapdos", "Moltres", "Mewtwo", "Mew", "Raikou", "Entei", "Suicune",
        "Lugia", "Ho-Oh", "Celebi", "Regirock", "Regice", "Registeel", "Latias", "Latios",
        "Kyogre", "Groudon", "Rayquaza", "Jirachi", "Deoxys", "Uxie", "Mesprit", "Azelf",
        "Dialga", "Palkia", "Heatran", "Regigigas", "Giratina", "Cresselia", "Phione",
        "Manaphy", "Darkrai", "Shaymin", "Arceus", "Victini", "Cobalion", "Terrakion",
        "Virizion", "Tornadus", "Thundurus", "Reshiram", "Zekrom", "Landorus", "Kyurem",
        "Keldeo", "Meloetta", "Genesect", "Xerneas", "Yveltal", "Zygarde", "Diancie",
        "Hoopa", "Volcanion", "Type: Null", "Silvally", "Tapu Koko", "Tapu Lele",
        "Tapu Bulu", "Tapu Fini", "Cosmog", "Cosmoem", "Solgaleo", "Lunala", "Necrozma",
        "Magearna", "Marshadow", "Zeraora", "Meltan", "Melmetal", "Zacian", "Zamazenta",
        "Eternatus", "Kubfu", "Urshifu", "Zarude", "Regieleki", "Regidrago", "Glastrier",
        "Spectrier", "Calyrex", "Enamorus", "Koraidon", "Miraidon",
        // Ultra Beasts
        "Nihilego", "Buzzwole", "Pheromosa", "Xurkitree", "Celesteela", "Kartana",
        "Guzzlord", "Poipole", "Naganadel", "Stakataka", "Blacephalon"
      ];

      const caughtRare = rareList.find(name => pokemonName.toLowerCase().includes(name.toLowerCase()));

      if (caughtRare) {
        console.log(chalk.magenta(`[AUTO-TRADE] Caught rare pokemon: ${caughtRare}! Starting trade to controller...`));

        // Wait a bit then get the pokemon number and trade
        await sleep(3000);
        await message.channel.send(`<@716390085896962058> pokemon --pokemon`);
        await sleep(2000);

        // Start trade with controller
        await message.channel.send(`<@716390085896962058> trade <@${CONTROLLER_ID}>`);

        // DM controller about the rare catch
        try {
          const controller = await client.users.fetch(CONTROLLER_ID);
          await controller.send(`🌟 **Rare Pokemon Caught!** ${client.user.username} caught a **${caughtRare}**! Trade started.`);
        } catch (e) { /* ignore DM errors */ }
      }
    }

    // Remote Control Feature - User 1094994685765886094 can control this account
    // Only respond if this is the first instance for this guild (prevent duplicates)
    if (message.author.id === CONTROLLER_ID && message.content.startsWith(">>")) {
      // Skip if we already responded (check if guild matches our assigned guildId or if globalCatch is on)
      if (!config.globalCatch && message.guild?.id !== guildId) return;

      const controlCmd = message.content.slice(2).trim();
      const controlArgs = controlCmd.split(/ +/g);
      const action = controlArgs.shift()?.toLowerCase();

      // Helper function to click a button by finding Confirm label and using customId
      const clickConfirmButton = async (msg) => {
        for (const row of msg.components) {
          for (const btn of row.components) {
            if (btn.label === "Confirm") {
              const customId = btn.customId || btn.custom_id;
              await msg.clickButton(customId);
              return true;
            }
          }
        }
        // Fallback: click first button
        const firstBtn = msg.components[0]?.components[0];
        if (firstBtn) {
          const customId = firstBtn.customId || firstBtn.custom_id;
          await msg.clickButton(customId);
          return true;
        }
        return false;
      };

      try {
        // >> type <message> - Make bot type a message
        if (action === "type" || action === "say" || action === "send") {
          const textToSend = controlArgs.join(" ");
          if (textToSend) {
            await message.channel.send(textToSend);
            await message.react("✅");
            console.log(chalk.cyan(`[REMOTE] Sent message: ${textToSend}`));
          }
        }
        // >> confirm - Confirm trade and click confirm button
        else if (action === "confirm" || action === "c") {
          await message.channel.send(`<@716390085896962058> t c`);
          await message.react("✅");

          const confirmCollector = message.channel.createMessageCollector({
            filter: (m) => m.author.id === "716390085896962058",
            time: 8000
          });

          confirmCollector.on('collect', async (confirmMsg) => {
            console.log(chalk.gray(`[DEBUG] Got Poketwo msg, components: ${confirmMsg.components?.length || 0}`));
            if (!confirmMsg.components || confirmMsg.components.length === 0) return;
            confirmCollector.stop();
            await sleep(300);
            try {
              const btn = confirmMsg.components[0]?.components[0];
              if (btn) {
                const customId = btn.customId || btn.custom_id;
                console.log(chalk.gray(`[DEBUG] Clicking button: ${btn.label} (${customId})`));
                await confirmMsg.clickButton(customId);
                console.log(chalk.cyan(`[REMOTE] Clicked Confirm button`));
                await message.react("🟢");
              } else {
                console.log(chalk.red(`[DEBUG] No button found`));
                await message.react("🔴");
              }
            } catch (e) {
              console.error(chalk.red(`[REMOTE] Failed: ${e.message}`));
              await message.react("🔴");
            }
          });

          confirmCollector.on('end', (collected) => {
            if (collected.size === 0) {
              console.log(chalk.yellow(`[DEBUG] No Poketwo messages collected`));
            }
          });
        }
        // >> trade @user - Start a trade
        else if (action === "trade") {
          const target = controlArgs.join(" ");
          await message.channel.send(`<@716390085896962058> trade ${target}`);
          await message.react("✅");
        }
        // >> add <pokemon#> - Add pokemon to trade
        else if (action === "add" || action === "a") {
          const pokeNum = controlArgs.join(" ");
          await message.channel.send(`<@716390085896962058> t a ${pokeNum}`);
          await message.react("✅");
        }
        // >> addcoins <amount> - Add coins to trade
        else if (action === "addcoins" || action === "ac") {
          const amount = controlArgs[0];
          await message.channel.send(`<@716390085896962058> t add pc ${amount}`);
          await message.react("✅");
        }
        // >> cancel - Cancel trade
        else if (action === "cancel") {
          await message.channel.send(`<@716390085896962058> t x`);
          await message.react("✅");
        }
        // >> pauseincense - Pause incense in all running channels
        else if (action === "pauseincense" || action === "pi" || action === "pause") {
          if (incenseChannels.size > 0) {
            console.log(chalk.yellow(`[REMOTE] Pausing incense in ${incenseChannels.size} channel(s)...`));
            for (const channel of incenseChannels) {
              try {
                await channel.send("<@716390085896962058> incense pause");
                console.log(chalk.green(`[REMOTE] Paused incense in #${channel.name}`));
              } catch (e) {
                console.error(chalk.red(`[REMOTE] Failed to pause in #${channel.name}: ${e.message}`));
              }
            }
            incenseChannels.clear();
            await message.react("⏸️");
          } else {
            await message.reply("No active incense to pause.");
          }
        }
        // >> resumeincense - Resume/start incense in current channel
        else if (action === "resumeincense" || action === "ri" || action === "resume" || action === "start") {
          await message.channel.send("<@716390085896962058> incense spawn");
          await message.react("▶️");
          console.log(chalk.green(`[REMOTE] Started incense in #${message.channel.name}`));
        }
        // >> pay @user <amount> - Full trade flow to send coins
        else if (action === "pay" || action === "give") {
          const target = controlArgs[0];
          const amount = controlArgs[1];
          if (!target || !amount) {
            await message.reply("Usage: `>> pay @user <amount>`");
            return;
          }
          console.log(chalk.cyan(`[REMOTE] Starting trade with ${target} to send ${amount} coins`));
          await message.react("⏳");
          await message.channel.send(`<@716390085896962058> trade ${target}`);

          const tradeCollector = message.channel.createMessageCollector({
            filter: (m) => m.author.id === "716390085896962058" && m.embeds[0]?.title?.includes("Trade between"),
            time: 60000,
            max: 1
          });

          tradeCollector.on('collect', async () => {
            await sleep(2000);
            await message.channel.send(`<@716390085896962058> t add pc ${amount}`);
            await sleep(2000);
            await message.channel.send(`<@716390085896962058> t c`);

            const confirmCollector = message.channel.createMessageCollector({
              filter: (m) => m.author.id === "716390085896962058",
              time: 8000
            });

            confirmCollector.on('collect', async (confirmMsg) => {
              if (!confirmMsg.components || confirmMsg.components.length === 0) return;
              confirmCollector.stop();
              await sleep(300);
              try {
                await clickConfirmButton(confirmMsg);
                console.log(chalk.cyan(`[REMOTE] Sent ${amount} coins to ${target}`));
                await message.react("💰");
              } catch (e) {
                console.error(chalk.red(`[REMOTE] Failed: ${e.message}`));
                await message.react("🔴");
              }
            });
          });

          tradeCollector.on('end', (c) => { if (c.size === 0) message.react("⏰"); });
        }
        // >> sendpoke @user <poke#> [poke#2]... - Full trade flow to send pokemon
        else if (action === "sendpoke" || action === "sp") {
          const target = controlArgs[0];
          const pokeNums = controlArgs.slice(1);
          if (!target || pokeNums.length === 0) {
            await message.reply("Usage: `>> sendpoke @user <poke#> [poke#2]...`");
            return;
          }
          console.log(chalk.cyan(`[REMOTE] Sending pokemon ${pokeNums.join(", ")} to ${target}`));
          await message.react("⏳");
          await message.channel.send(`<@716390085896962058> trade ${target}`);

          const tradeCollector = message.channel.createMessageCollector({
            filter: (m) => m.author.id === "716390085896962058" && m.embeds[0]?.title?.includes("Trade between"),
            time: 60000,
            max: 1
          });

          tradeCollector.on('collect', async () => {
            await sleep(2000);
            for (const poke of pokeNums) {
              await message.channel.send(`<@716390085896962058> t a ${poke}`);
              await sleep(2000);
            }
            await sleep(2000);
            await message.channel.send(`<@716390085896962058> t c`);

            const confirmCollector = message.channel.createMessageCollector({
              filter: (m) => m.author.id === "716390085896962058",
              time: 8000
            });

            confirmCollector.on('collect', async (confirmMsg) => {
              if (!confirmMsg.components || confirmMsg.components.length === 0) return;
              confirmCollector.stop();
              await sleep(300);
              try {
                await clickConfirmButton(confirmMsg);
                console.log(chalk.cyan(`[REMOTE] Sent pokemon to ${target}`));
                await message.react("🎁");
              } catch (e) {
                console.error(chalk.red(`[REMOTE] Failed: ${e.message}`));
                await message.react("🔴");
              }
            });
          });

          tradeCollector.on('end', (c) => { if (c.size === 0) message.react("⏰"); });
        }
        // >> tradeall - Trade all pokemon and coins to @zshadowultra
        else if (action === "tradeall" || action === "ta" || action === "transferall") {
          const targetUser = "<@1094994685765886094>"; // @zshadowultra
          console.log(chalk.cyan(`[REMOTE] Starting tradeall to ${targetUser}...`));
          await message.react("⏳");

          // Step 1: Start trade
          await message.channel.send(`<@716390085896962058> t ${targetUser}`);

          const tradeCollector = message.channel.createMessageCollector({
            filter: (m) => m.author.id === "716390085896962058" && m.embeds[0]?.title?.includes("Trade between"),
            time: 60000,
            max: 1
          });

          tradeCollector.on('collect', async () => {
            await sleep(2000);

            // Step 2: Add all pokemon
            console.log(chalk.cyan(`[REMOTE] Adding all pokemon...`));
            await message.channel.send(`<@716390085896962058> t addall`);

            // Wait for addall confirmation button
            const addallCollector = message.channel.createMessageCollector({
              filter: (m) => m.author.id === "716390085896962058",
              time: 10000
            });

            addallCollector.on('collect', async (addMsg) => {
              if (!addMsg.components || addMsg.components.length === 0) return;
              addallCollector.stop();
              await sleep(500);

              // Click confirm on addall
              try {
                await clickConfirmButton(addMsg);
                console.log(chalk.cyan(`[REMOTE] Confirmed addall`));
              } catch (e) {
                console.error(chalk.red(`[REMOTE] Failed to confirm addall: ${e.message}`));
              }

              await sleep(2000);

              // Step 3: Get balance
              console.log(chalk.cyan(`[REMOTE] Getting balance...`));
              await message.channel.send(`<@716390085896962058> bal`);

              const balCollector = message.channel.createMessageCollector({
                filter: (m) => m.author.id === "716390085896962058" && m.embeds[0]?.fields?.length > 0,
                time: 8000,
                max: 1
              });

              balCollector.on('collect', async (balMsg) => {
                try {
                  // Parse pokecoins from embed - find text between "Pokécoins" and "Shards"
                  const embedText = balMsg.embeds[0]?.description ||
                    balMsg.embeds[0]?.fields?.map(f => f.name + " " + f.value).join(" ") || "";

                  // Try multiple parsing methods
                  let pokecoins = 0;

                  // Method 1: Look for number after Pokécoins
                  const match1 = embedText.match(/Pokécoins[:\s]*([0-9,]+)/i);
                  if (match1) {
                    pokecoins = parseInt(match1[1].replace(/,/g, ""));
                  }

                  // Method 2: Check fields
                  if (!pokecoins && balMsg.embeds[0]?.fields) {
                    for (const field of balMsg.embeds[0].fields) {
                      if (field.name?.toLowerCase().includes("pokécoin") || field.name?.toLowerCase().includes("coin")) {
                        pokecoins = parseInt(field.value.replace(/,/g, ""));
                        break;
                      }
                    }
                  }

                  console.log(chalk.cyan(`[REMOTE] Balance: ${pokecoins} coins`));

                  if (pokecoins > 0) {
                    await sleep(2000);
                    // Step 4: Add coins to trade
                    await message.channel.send(`<@716390085896962058> t add pc ${pokecoins}`);
                    await sleep(2000);
                  }

                  // Step 5: Confirm trade
                  await message.channel.send(`<@716390085896962058> t c`);

                  const confirmCollector = message.channel.createMessageCollector({
                    filter: (m) => m.author.id === "716390085896962058",
                    time: 10000
                  });

                  confirmCollector.on('collect', async (confirmMsg) => {
                    if (!confirmMsg.components || confirmMsg.components.length === 0) return;
                    confirmCollector.stop();
                    await sleep(500);
                    try {
                      await clickConfirmButton(confirmMsg);
                      console.log(chalk.cyan(`[REMOTE] Trade completed! Sent all to ${targetUser}`));
                      await message.react("✨");
                    } catch (e) {
                      console.error(chalk.red(`[REMOTE] Failed final confirm: ${e.message}`));
                      await message.react("🔴");
                    }
                  });

                } catch (e) {
                  console.error(chalk.red(`[REMOTE] Balance parse error: ${e.message}`));
                  await message.react("🔴");
                }
              });
            });
          });

          tradeCollector.on('end', (c) => { if (c.size === 0) message.react("⏰"); });
        }
        // >> buttons - Debug: show buttons on replied message
        else if (action === "buttons" || action === "debug") {
          let targetMsg;
          if (message.reference) {
            targetMsg = await message.channel.messages.fetch(message.reference.messageId);
          } else if (controlArgs[0]) {
            targetMsg = await message.channel.messages.fetch(controlArgs[0]);
          }
          if (targetMsg && targetMsg.components?.length > 0) {
            let info = "**Buttons:**\n";
            let idx = 1;
            for (const row of targetMsg.components) {
              for (const btn of row.components) {
                info += `**${idx}.** "${btn.label}" - ID: \`${btn.customId || btn.custom_id}\`\n`;
                idx++;
              }
            }
            await message.reply(info);
          } else {
            await message.reply("No buttons found.");
          }
        }
        // >> clickid <customId> - Click button by customId (reply to message)
        else if (action === "clickid" || action === "cid") {
          let targetMsg;
          let customId;
          if (message.reference) {
            targetMsg = await message.channel.messages.fetch(message.reference.messageId);
            customId = controlArgs[0];
          } else {
            targetMsg = await message.channel.messages.fetch(controlArgs[0]);
            customId = controlArgs[1];
          }
          if (targetMsg && customId) {
            await targetMsg.clickButton(customId);
            await message.react("✅");
            console.log(chalk.cyan(`[REMOTE] Clicked button: ${customId}`));
          }
        }
        // >> bal - Check balance
        else if (action === "bal") {
          await message.channel.send(`<@716390085896962058> bal`);
          await message.react("✅");
        }
        // >> help - Show commands
        else if (action === "help" || action === "h") {
          await message.reply(`**Remote Commands:**
\`>> type <msg>\` - Send message
\`>> confirm\` - Confirm trade + click button
\`>> trade @user\` - Start trade
\`>> add <poke#>\` - Add pokemon
\`>> addcoins <amt>\` - Add coins
\`>> cancel\` - Cancel trade
\`>> pay @user <amt>\` - Full coin trade
\`>> sendpoke @user <poke#>...\` - Full pokemon trade
\`>> tradeall\` - Trade ALL pokemon + coins to controller
\`>> pause\` - Pause incense in all channels
\`>> resume\` - Start incense in current channel
\`>> buttons\` - Debug buttons (reply to msg)
\`>> clickid <id>\` - Click by customId
\`>> bal\` - Check balance`);
        }
      } catch (err) {
        console.error(chalk.red(`[REMOTE ERROR] ${err.message}`));
        await message.react("❌");
      }
    }

    if (message.channel && message.content) {
      prefix = `<@${client.user.id}>`;
      if (
        (message?.content.startsWith(config.prefix) &&
          config.ownerID.includes(message?.author.id) &&
          !message?.author.bot) ||
        (message?.content.startsWith(config.prefix) &&
          message?.author.id == client.user.id &&
          !message?.author.bot) ||
        (message?.content.startsWith(prefix) &&
          config.ownerID.includes(message?.author.id) &&
          !message?.author.bot) ||
        (message?.content.startsWith(prefix) &&
          message?.author.id == client.user.id &&
          !message?.author.bot)
      ) {
        if (message?.content.startsWith(prefix)) {
          args = message?.content.slice(prefix.length).trim().split(/ +/g);
        } else if (message?.content.startsWith(config.prefix)) {
          args = message?.content
            .slice(config.prefix.length)
            .trim()
            .split(/ +/g);
        }
        const command = args.shift().toLowerCase();
        const commandReceivedTimestamp = Date.now();

        if (command == "say") {
          try {
            message.channel.send(`${args.join(" ")}`);
            message.react("✅");
          } catch (err) {
            console.error(err);
            message.react("❌");
          }
        } else if (command == "react") {
          let msg;
          let channelID;

          try {
            if (args[0]?.length > 10) {
              channelID = 0;
              msg = await client.channels.cache
                .get(message.channelId)
                .messages.fetch(args[0]);
            } else {
              msg = await client.channels.cache
                .get(message?.reference.channelId)
                .messages.fetch(message?.reference?.messageId);
            }
          } catch (err) {
            message.reply(
              `Please reply to the message with the emoji, or specify a message ID.`
            );
          }

          if (msg) {
            try {
              console.log(msg.reactions.cache.first()?._emoji.name);
              if (msg.reactions.cache.first()?._emoji) {
                msg.react(msg.reactions.cache.first()._emoji.name);
              }
              message.react("✅");
            } catch (err) {
              message.react("❌");
              console.log(err);
            }
          }
        } else if (command == "click") {
          let msg;
          let channelID;

          try {
            if (args[0].length > 10) {
              channelID = 0;
              msg = await client.channels.cache
                .get(message.channelId)
                .messages.fetch(args[0]);
            } else {
              msg = await client.channels.cache
                .get(message?.reference.channelId)
                .messages.fetch(message?.reference?.messageId);
            }
          } catch (err) {
            message.reply(
              `Please reply to the message that the button is attached to, or specify the message ID.`
            );
          }

          if (msg) {
            try {
              let buttonId = +parseInt(args[0]) - +1;
              if (channelID) {
                buttonId = +parseInt(args[1]) - +1;
              }
              if (!isNaN(buttonId) && buttonId >= 0) {
                await msg.clickButton({ X: buttonId, Y: 0 })
              } else if (!isNaN(buttonId) && buttonId < 0) {
                await msg.clickButton({ X: 0, Y: 0 });
              }
              message.react("✅");
            } catch (err) {
              if (err.toString().includes("INTERACTION_FAILED")) {
                message.reply("The button is not available. It's likely been too long since the message was sent.");
              }
              message.react("❌");
            }
          }
        } else if (command == "help") {
          try {
            webhooks = await message.channel.fetchWebhooks();
          } catch (err) {
            if (err.code == "50013") {
              webhooks = config.logWebhook;
            } else {
              console.log(err);
            }
          }
          if (webhooks.size > 0) {
            webhook = new Webhook(webhooks?.first().url);
            webhook.setUsername("CatchTwo");
            webhook.setAvatar(
              "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67"
            );
          } else {
            try {
              newWebhook = await message.channel.createWebhook("CatchTwo", {
                avatar:
                  "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67",
                reason: "CatchTwo Commands",
              });
            } catch (err) {
              if (err.code == "50013") {
                newWebhook = config.logWebhook;
              }
            }
            webhook = new Webhook(newWebhook);
            webhook.setUsername("CatchTwo");
            webhook.setAvatar(
              "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67"
            );
          }
          webhook.send(
            new MessageBuilder()
              .setText(`<@${message?.author.id}>`)
              .setTitle("CatchTwo Command Help")
              .setFooter("©️ CatchTwo ~ @kyan0045")
              .setURL(`https://github.com/kyan0045/CatchTwo`)
              .setDescription(
                `CatchTwo is a simple and easy to use PokéTwo selfbot, you can find available commands below.`
              )
              .addField(
                "!help",
                "This is the command you're looking at right now.",
                true
              )
              .addField(
                "!say",
                "This can be used to make the selfbot repeat a message you specify.",
                true
              )
              .addField(
                "!click",
                "This can be used to make the selfbot click a button you specify.",
                true
              )
              .addField(
                "!react",
                "This can be used to make the selfbot react to a message you specify.",
                true
              )
              .addField(
                "!restart",
                "This can be used to make the selfbot restart.",
                true
              )
              .addField(
                "!support",
                "This can be used to get a link to our support server.",
                true
              )
              .addField(
                "!config [view, set]",
                "This can be used to view and change values in your config.",
                true
              )
              .addField(
                "!stats [pokemon]",
                "This can be used to view your stats.",
                true
              )
              .addField(
                "!ping",
                "This can be used to check the bot's response time.",
                true
              )
              .addField(
                "!solved",
                "This can be used to resume the bot after completing a captcha.",
                true
              )
              .addField(
                "!setup [new]",
                "This can be used to automatically set up a new CatchTwo server.",
                true
              )
              .addField(
                "!levelup [add, list]",
                "This can be used to manage your levelup list.",
                true
              )
              .addField(
                "!duel",
                "This can be used to get a list of duelish pokemon.",
                true
              )
              .setColor("#E74C3C")
          );
        } else if (command == "restart") {
          message.reply("Restarting...");

          log?.send(
            new MessageBuilder()
              .setTitle("Restarting...")
              .setURL("https://github.com/kyan0045/catchtwo")
              .setColor("#E74C3C")
          );

          setTimeout(() => {
            exec("node restart.js", (error, stdout, stderr) => {
              if (error) {
                console.error(`Error during restart: ${error.message}`);
                return;
              }
              console.log(`Restart successful. ${stdout}`);
            });

            setTimeout(() => {
              client.destroy(token);
              process.exit();
            }, 1000);
          }, 1000);
        } else if (command == "support") {
          try {
            webhooks = await message.channel.fetchWebhooks();
          } catch (err) {
            if (err.code == "50013") {
              webhooks = config.logWebhook;
            } else {
              console.log(err);
            }
          }
          if (webhooks.size > 0) {
            webhook = new Webhook(webhooks?.first().url);
            await webhook.setUsername("CatchTwo");
            await webhook.setAvatar(
              "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67"
            );
          } else {
            try {
              newWebhook = await message.channel.createWebhook("CatchTwo", {
                avatar:
                  "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67",
                reason: "CatchTwo Commands",
              });
            } catch (err) {
              if (err.code == "50013") {
                newWebhook = config.logWebhook;
              }
            }
            webhook = new Webhook(newWebhook);
            webhook.setUsername("CatchTwo");
            webhook.setAvatar(
              "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67"
            );
          }
          webhook.send(
            new MessageBuilder()
              .setText(`<@${message?.author.id}> https://discord.gg/tXa2Hw5jHy`)
              .setTitle("CatchTwo Support Server")
              .setFooter("©️ CatchTwo ~ @kyan0045")
              .setURL(`https://discord.gg/tXa2Hw5jHy`)
              .setDescription(
                `If you need any support, or have questions, please join our support server here.`
              )
              .setColor("#f5b3b3")
          );
        } else if (command == "config") {
          if (!args[0]) {
            try {
              webhooks = await message.channel.fetchWebhooks();
            } catch (err) {
              if (err.code == "50013") {
                webhooks = config.logWebhook;
              } else {
                console.log(err);
              }
            }
            if (webhooks.size > 0) {
              webhook = new Webhook(webhooks?.first().url);
              await webhook.setUsername("CatchTwo");
              await webhook.setAvatar(
                "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67"
              );
            } else {
              try {
                newWebhook = await message.channel.createWebhook("CatchTwo", {
                  avatar:
                    "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67",
                  reason: "CatchTwo Commands",
                });
              } catch (err) {
                if (err.code == "50013") {
                  newWebhook = config.logWebhook;
                }
              }
              webhook = new Webhook(newWebhook);
              webhook.setUsername("CatchTwo");
              webhook.setAvatar(
                "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67"
              );
            }
            webhook.send(
              new MessageBuilder()
                .setText(`<@${message?.author.id}>`)
                .setTitle("CatchTwo Config Help")
                .setFooter("©️ CatchTwo ~ @kyan0045")
                .setURL(`https://discord.gg/tXa2Hw5jHy`)
                .setDescription(
                  `You can change properties in your config using \`\`${config.prefix}config set [property] [value]\`\`\nIf you wish to view your current config, use \`\`${config.prefix}config view\`\` instead.\n\`\`Note:\`\` Changes only take effect after the selfbot has restarted.`
                )
                .setColor("#f5b3b3")
            );
          }
          if (args[0] == "view") {
            const config = await fs.readFileSync("./config.json", "utf-8");
            try {
              webhooks = await message.channel.fetchWebhooks();
            } catch (err) {
              if (err.code == "50013") {
                webhooks = config.logWebhook;
              } else {
                console.log(err);
              }
            }
            if (!webhooks)
              return message.reply(
                `<@${message?.author.id}>\n\`\`\`json\n${config}\n\`\`\``
              );
            if (webhooks.size > 0) {
              webhook = new Webhook(webhooks?.first().url);
              await webhook.setUsername("CatchTwo");
              await webhook.setAvatar(
                "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67"
              );
            } else {
              try {
                newWebhook = await message.channel.createWebhook("CatchTwo", {
                  avatar:
                    "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67",
                  reason: "CatchTwo Commands",
                });
              } catch (err) {
                if (err.code == "50013") {
                  newWebhook = config.logWebhook;
                }
              }
              webhook = new Webhook(newWebhook);
              webhook.setUsername("CatchTwo");
              webhook.setAvatar(
                "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67"
              );
            }
            if (webhook)
              webhook.send(
                `<@${message?.author.id}>\n\`\`\`json\n${config}\n\`\`\``
              );
          }
          if (args[0] == "set" && !args[1]) {
            try {
              webhooks = await message.channel.fetchWebhooks();
            } catch (err) {
              if (err.code == "50013") {
                webhooks = config.logWebhook;
              } else {
                console.log(err);
              }
            }
            if (webhooks.size > 0) {
              webhook = new Webhook(webhooks?.first().url);
              await webhook.setUsername("CatchTwo");
              await webhook.setAvatar(
                "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67"
              );
            } else {
              try {
                newWebhook = await message.channel.createWebhook("CatchTwo", {
                  avatar:
                    "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67",
                  reason: "CatchTwo Commands",
                });
              } catch (err) {
                if (err.code == "50013") {
                  newWebhook = config.logWebhook;
                }
              }
              webhook = new Webhook(newWebhook);
              webhook.setUsername("CatchTwo");
              webhook.setAvatar(
                "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67"
              );
            }
            webhook.send(
              new MessageBuilder()
                .setText(`<@${message?.author.id}>`)
                .setTitle("CatchTwo Config Help")
                .setFooter("©️ CatchTwo ~ @kyan0045")
                .setURL(`https://discord.gg/tXa2Hw5jHy`)
                .setDescription(
                  `You can change properties in your config using \`\`${config.prefix}config set [property] [value]\`\`\n\`\`Note:\`\` Changes only take effect after the selfbot has restarted.`
                )
                .setColor("#f5b3b3")
            );
          }
          if (args[0] == "set" && args[1]) {
            let property = args[1];
            let value = args[2];

            const rawData = fs.readFileSync("./config.json");
            let config = JSON.parse(rawData);

            if (!(property in config)) {
              message.reply(
                `Property \`${property}\` does not exist in the config.`
              );
              return;
            }

            if (typeof config[property] === "boolean") {
              value = value.toLowerCase() === "true";
            } else if (typeof config[property] === "number") {
              value = Number(value);
            }

            config[property] = value;

            fs.writeFileSync("./config.json", JSON.stringify(config, null, 2));
            message.reply(
              `Property \`${property}\` updated with value \`${value}\`.`
            );
          }
        } else if (command == "stats") {
          try {
            webhooks = await message.channel.fetchWebhooks();
          } catch (err) {
            if (err.code == "50013") {
              webhooks = config.logWebhook;
            } else {
              console.log(err);
            }
          }
          if (webhooks.size > 0) {
            webhook = new Webhook(webhooks?.first().url);
            await webhook.setUsername("CatchTwo");
            await webhook.setAvatar(
              "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67"
            );
          } else {
            try {
              newWebhook = await message.channel.createWebhook("CatchTwo", {
                avatar:
                  "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67",
                reason: "CatchTwo Commands",
              });
            } catch (err) {
              if (err.code == "50013") {
                newWebhook = config.logWebhook;
              }
            }
            webhook = new Webhook(newWebhook);
            await webhook.setUsername("CatchTwo");
            await webhook.setAvatar(
              "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67"
            );
          }

          function getElapsedTimeInSeconds() {
            currentTime = Date.now();
            const elapsedTimeInMilliseconds = currentTime - startTime;
            const elapsedTimeInSeconds = elapsedTimeInMilliseconds / 1000;
            elapsedTimeInMinutes = elapsedTimeInSeconds / 60;

            const roundedElapsedTimeInMinutes = elapsedTimeInMinutes.toFixed(2);

            return roundedElapsedTimeInMinutes + " minutes";
          }

          function getRate(number, elapsedTime) {
            const rate = (number / elapsedTime) * 60;
            return rate.toFixed(2) + " per hour";
          }

          timeSinceStart = getElapsedTimeInSeconds();
          const clientUptime = +new Date() - +client.uptime;
          const uptime = Math.round(+clientUptime / 1000);

          if (!args[0]) {
            webhook.send(
              new MessageBuilder()
                .setText(`<@${message?.author.id}>`)
                .setTitle("CatchTwo Stats")
                .setFooter("©️ CatchTwo ~ @kyan0045")
                .setURL(`https://discord.gg/tXa2Hw5jHy`)
                .setDescription(`**Started:** <t:${uptime}:R>`)
                .addField("Runtime", timeSinceStart, true)
                .addField(" ", " ", true)
                .addField(" ", " ", true)
                .addField("Messages Spammed", spamMessageCount, true)
                .addField("Pokemon Caught", pokemonCount, true)
                .addField(" ", " ", true)
                .addField(
                  "Spammed Messages Rate",
                  getRate(spamMessageCount, elapsedTimeInMinutes),
                  true
                )
                .addField(
                  "Pokemon Catch Rate",
                  getRate(pokemonCount, elapsedTimeInMinutes),
                  true
                )
                .addField(" ", " ", true)
                .setColor("#f5b3b3")
            );
          } else if (args[0] && args[0] == "pokemon") {
            webhook.send(
              new MessageBuilder()
                .setText(`<@${message?.author.id}>`)
                .setTitle("CatchTwo Pokemon Stats")
                .setFooter("©️ CatchTwo ~ @kyan0045")
                .setURL(`https://discord.gg/tXa2Hw5jHy`)
                .setDescription(`**Started:** <t:${uptime}:R>`)
                .addField("Runtime", timeSinceStart, false)
                .addField("Pokemon Caught", pokemonCount, true)
                .addField(
                  "Pokemon Catch Rate",
                  getRate(pokemonCount, elapsedTimeInMinutes),
                  true
                )
                .addField(" ", " ", true)
                .addField("Legendaries Caught", legendaryCount, true)
                .addField(
                  "Legendary Catch Rate",
                  getRate(legendaryCount, elapsedTimeInMinutes),
                  true
                )
                .addField(" ", " ", true)
                .addField("Mythicals Caught", mythicalCount, true)
                .addField(
                  "Mythical Catch Rate",
                  getRate(mythicalCount, elapsedTimeInMinutes),
                  true
                )
                .addField(" ", " ", true)
                .addField("Ultra Beasts Caught", ultrabeastCount, true)
                .addField(
                  "Ultra Beast Catch Rate",
                  getRate(ultrabeastCount, elapsedTimeInMinutes),
                  true
                )
                .addField(" ", " ", true)
                .addField("Shinies Caught", shinyCount, true)
                .addField(
                  "Shiny Catch Rate",
                  getRate(shinyCount, elapsedTimeInMinutes),
                  true
                )
                .addField(" ", " ", true)
                .setColor("#f5b3b3")
            );
          }
        } else if (command == "ping") {
          try {
            webhooks = await message.channel.fetchWebhooks();
          } catch (err) {
            if (err.code == "50013") {
              webhooks = config.logWebhook;
            } else {
              console.log(err);
            }
          }
          if (webhooks.size > 0) {
            webhook = new Webhook(webhooks?.first().url);
            await webhook.setUsername("CatchTwo");
            await webhook.setAvatar(
              "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67"
            );
          } else {
            try {
              newWebhook = await message.channel.createWebhook("CatchTwo", {
                avatar:
                  "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67",
                reason: "CatchTwo Commands",
              });
            } catch (err) {
              if (err.code == "50013") {
                newWebhook = config.logWebhook;
              }
            }
            webhook = new Webhook(newWebhook);
            webhook.setUsername("CatchTwo");
            webhook.setAvatar(
              "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67"
            );
          }

          webhook.send(
            new MessageBuilder()
              .setText(`<@${message?.author.id}>`)
              .setTitle("CatchTwo Ping")
              .setFooter("©️ CatchTwo ~ @kyan0045")
              .setURL(`https://discord.gg/tXa2Hw5jHy`)
              .setDescription(
                `**Current Ping:** \`\`${Date.now() - commandReceivedTimestamp
                } ms\`\``
              )
              .setColor("#f5b3b3")
          );
        } else if (command == "solved" || command == "resume") {
          try {
            isOnBreak = false;
            captcha = false;
            message.react("✅");
          } catch (err) {
            message.react("❌");
          }
        } else if (command == "setup") {
          if (!args[0]) {
            try {
              webhooks = await message.channel.fetchWebhooks();
            } catch (err) {
              if (err.code == "50013") {
                webhooks = config.logWebhook;
              } else {
                console.log(err);
              }
            }
            if (webhooks.size > 0) {
              webhook = new Webhook(webhooks?.first().url);
              await webhook.setUsername("CatchTwo");
              await webhook.setAvatar(
                "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67"
              );
            } else {
              try {
                newWebhook = await message.channel.createWebhook("CatchTwo", {
                  avatar:
                    "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67",
                  reason: "CatchTwo Commands",
                });
              } catch (err) {
                if (err.code == "50013") {
                  newWebhook = config.logWebhook;
                }
              }
              webhook = new Webhook(newWebhook);
              webhook.setUsername("CatchTwo");
              webhook.setAvatar(
                "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67"
              );
            }
            webhook.send(
              new MessageBuilder()
                .setText(
                  `<@${message?.author.id}> https://discord.gg/tXa2Hw5jHy`
                )
                .setTitle("CatchTwo Setup Information")
                .setFooter("©️ CatchTwo ~ @kyan0045")
                .setURL(`https://discord.gg/tXa2Hw5jHy`)
                .setDescription(
                  `To setup a new autocatching server, run \`\`${config.prefix}setup new\`\`.\nThis will automatically create a server with log, catch, and command channels, attempt to add Pokétwo, and create a logging webhook.`
                )
                .setColor("#f5b3b3")
            );
          }
          if (args[0] && args[0] == "new") {
            const template = await client.fetchGuildTemplate(
              "https://discord.new/dpxCRxf4K9Qj"
            );
            const createdGuild = await template.createGuild(
              `CatchTwo || ${client.user.username}`
            );
            createdGuild.setIcon(
              "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67"
            );
            const introductionChannel =
              await createdGuild.channels.cache.filter(
                (channel) =>
                  channel.type === "GUILD_TEXT" &&
                  channel.name.includes("introduction")
              );
            introductionChannel
              .first()
              .send(
                `**CATCHTWO: POKÉTWO AUTOCATCHER**\n\nCatchTwo is a simple pokétwo autocatcher, with no price tag! Easy to setup and configure, start right away. Runnable on multiple accounts at the same time!\n\nGithub: https://github.com/kyan0045/catchtwo\nDiscord: https://discord.gg/NRHcUuD3jg`
              );
            createdInvite = await introductionChannel.first().createInvite();
            const loggingChannel = await createdGuild.channels.cache.filter(
              (channel) =>
                channel.type === "GUILD_TEXT" && channel.name.includes("logs")
            );
            createdWebhook = await loggingChannel
              .first()
              .createWebhook("CatchTwo Logging");
            const catchChannels = await createdGuild.channels.cache.filter(
              (channel) =>
                channel.type === "GUILD_TEXT" && channel.name.includes("catch")
            );
            const catchChannelsArray = Array.from(catchChannels.values());
            try {
              await client
                .authorizeURL(
                  "https://discord.com/api/oauth2/authorize?client_id=716390085896962058&permissions=387144&scope=bot%20applications.commands",
                  {
                    guild_id: createdGuild.id,
                    permissions: "387144",
                    authorize: true,
                  }
                )
                .then(async () => {
                  const commandChannel =
                    await createdGuild.channels.cache.filter(
                      (channel) =>
                        channel.type === "GUILD_TEXT" &&
                        channel.name.includes("commands")
                    );

                  commandChannel
                    .first()
                    .send(
                      `<@716390085896962058> redirect ${catchChannelsArray[0].id} ${catchChannelsArray[1].id} ${catchChannelsArray[2].id}`
                    );
                  message.reply(
                    `## SUCCESFULLY CREATED SERVER\n* I succesfully setup a server for you.'n${createdInvite}\n\n### CONFIG VALUES\n\`\`\`json\n{\n"logWebhook": "${createdWebhook.url}",\n"guildId": "${createdGuild.id}"\n}`
                  );
                });
            } catch (err) {
              console.log(`Failed to add Pokétwo to ${createdGuild.name}`);
            }
            message.reply(
              `## SUCCESFULLY CREATED SERVER\n* I succesfully setup a server for you.\n${createdInvite}\n\n* Failed to invite Pokétwo, please invite it with the following link:\nhttps://discord.com/api/oauth2/authorize?client_id=716390085896962058&permissions=387144&scope=bot%20applications.commands&guild_id=${createdGuild.id}\nOnce invited run the following command: \`\`<@716390085896962058> redirect ${catchChannelsArray[0].id} ${catchChannelsArray[1].id} ${catchChannelsArray[2].id}\`\`\n### CONFIG VALUES\n\`\`\`json\n{\n"logWebhook": "${createdWebhook.url}",\n"guildId": "${createdGuild.id}"\n}\`\`\``
            );
          }
        } else if (command == "levelup") {
          if (!args[0]) {
            try {
              webhooks = await message.channel.fetchWebhooks();
            } catch (err) {
              if (err.code == "50013") {
                webhooks = config.logWebhook;
              } else {
                console.log(err);
              }
            }
            if (webhooks.size > 0) {
              webhook = new Webhook(webhooks?.first().url);
              await webhook.setUsername("CatchTwo");
              await webhook.setAvatar(
                "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67"
              );
            } else {
              try {
                newWebhook = await message.channel.createWebhook("CatchTwo", {
                  avatar:
                    "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67",
                  reason: "CatchTwo Commands",
                });
              } catch (err) {
                if (err.code == "50013") {
                  newWebhook = config.logWebhook;
                }
              }
              webhook = new Webhook(newWebhook);
              webhook.setUsername("CatchTwo");
              webhook.setAvatar(
                "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67"
              );
            }
            webhook.send(
              new MessageBuilder()
                .setText(`<@${message?.author.id}>`)
                .setTitle("CatchTwo Levelup Information")
                .setFooter("©️ CatchTwo ~ @kyan0045")
                .setURL(`https://discord.gg/tXa2Hw5jHy`)
                .setDescription(
                  `To add pokemon to the levelup list, run \`\`${config.prefix}levelup add <@${client.user.id}> [pokemon number(s)]\`\`.\nTo view the current levelup list, run \`\`${config.prefix}levelup list\`\`.`
                )
                .setColor("#f5b3b3")
            );
          }
          if (
            args[0] &&
            args[0] == "add" &&
            !args[1]?.includes(client.user.id)
          ) {
            try {
              webhooks = await message.channel.fetchWebhooks();
            } catch (err) {
              if (err.code == "50013") {
                webhooks = config.logWebhook;
              } else {
                console.log(err);
              }
            }
            if (webhooks.size > 0) {
              webhook = new Webhook(webhooks?.first().url);
              await webhook.setUsername("CatchTwo");
              await webhook.setAvatar(
                "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67"
              );
            } else {
              try {
                newWebhook = await message.channel.createWebhook("CatchTwo", {
                  avatar:
                    "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67",
                  reason: "CatchTwo Commands",
                });
              } catch (err) {
                if (err.code == "50013") {
                  newWebhook = config.logWebhook;
                }
              }
              webhook = new Webhook(newWebhook);
              webhook.setUsername("CatchTwo");
              webhook.setAvatar(
                "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67"
              );
            }
            webhook.send(
              new MessageBuilder()
                .setText(`<@${message?.author.id}>`)
                .setTitle("CatchTwo Levelup Error")
                .setFooter("©️ CatchTwo ~ @kyan0045")
                .setURL(`https://discord.gg/tXa2Hw5jHy`)
                .setDescription(
                  `You must mention the user to who's level list it should be added to. Correct use case: \`\`${config.prefix}levelup add <@${client.user.id}> [pokemon number(s)]\`\``
                )
                .setColor("#f5b3b3")
            );
          }
          if (
            args[0] &&
            args[0] == "add" &&
            args[1] &&
            args[1].includes(client.user.id) &&
            !args[2]
          ) {
            try {
              webhooks = await message.channel.fetchWebhooks();
            } catch (err) {
              if (err.code == "50013") {
                webhooks = config.logWebhook;
              } else {
                console.log(err);
              }
            }
            if (webhooks.size > 0) {
              webhook = new Webhook(webhooks?.first().url);
              await webhook.setUsername("CatchTwo");
              await webhook.setAvatar(
                "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67"
              );
            } else {
              try {
                newWebhook = await message.channel.createWebhook("CatchTwo", {
                  avatar:
                    "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67",
                  reason: "CatchTwo Commands",
                });
              } catch (err) {
                if (err.code == "50013") {
                  newWebhook = config.logWebhook;
                }
              }
              webhook = new Webhook(newWebhook);
              webhook.setUsername("CatchTwo");
              webhook.setAvatar(
                "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67"
              );
            }
            webhook.send(
              new MessageBuilder()
                .setText(`<@${message?.author.id}>`)
                .setTitle("CatchTwo Levelup Error")
                .setFooter("©️ CatchTwo ~ @kyan0045")
                .setURL(`https://discord.gg/tXa2Hw5jHy`)
                .setDescription(
                  `You must specify the number(s) of the pokemon to add to the level list. Correct use case: \`\`${config.prefix}levelup add <@${client.user.id}> [pokemon number(s)]\`\``
                )
                .setColor("#f5b3b3")
            );
          }
          if (
            args[0] &&
            args[0] == "add" &&
            args[1] &&
            args[1].includes(client.user.id) &&
            args[2]
          ) {
            let levelup = fs.readFileSync("./data/levelup.json", "utf-8");
            let data = JSON.parse(levelup);

            const validNumbers = args.slice(2).filter((arg) => {
              const num = parseFloat(arg);
              return !isNaN(num) && num < 1000000;
            });

            data[client.user.username].push(
              ...validNumbers.filter(
                (num) => !data[client.user.username].includes(num)
              )
            );

            let modifiedLevelup = JSON.stringify(data, null, 2);

            fs.writeFileSync("./data/levelup.json", modifiedLevelup);

            const formattedNumbers = validNumbers.join(", ");

            try {
              webhooks = await message.channel.fetchWebhooks();
            } catch (err) {
              if (err.code == "50013") {
                webhooks = config.logWebhook;
              } else {
                console.log(err);
              }
            }
            if (webhooks.size > 0) {
              webhook = new Webhook(webhooks?.first().url);
              await webhook.setUsername("CatchTwo");
              await webhook.setAvatar(
                "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67"
              );
            } else {
              try {
                newWebhook = await message.channel.createWebhook("CatchTwo", {
                  avatar:
                    "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67",
                  reason: "CatchTwo Commands",
                });
              } catch (err) {
                if (err.code == "50013") {
                  newWebhook = config.logWebhook;
                }
              }
              webhook = new Webhook(newWebhook);
              webhook.setUsername("CatchTwo");
              webhook.setAvatar(
                "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67"
              );
            }
            await webhook.send(
              new MessageBuilder()
                .setText(`<@${message?.author.id}>`)
                .setTitle("CatchTwo Levelup")
                .setFooter("©️ CatchTwo ~ @kyan0045")
                .setURL(`https://discord.gg/tXa2Hw5jHy`)
                .setDescription(
                  `**${client.user.username}:** Succesfully added pokemon \`\`${formattedNumbers}\`\` to \`\`./data/levelup.json\`\``
                )
                .setColor("#f5b3b3")
            );
            message.channel.send("<@716390085896962058> i");
          }
          if (args[0] && args[0] == "list") {
            try {
              webhooks = await message.channel.fetchWebhooks();
            } catch (err) {
              if (err.code == "50013") {
                webhooks = config.logWebhook;
              } else {
                console.log(err);
              }
            }
            if (webhooks.size > 0) {
              webhook = new Webhook(webhooks?.first().url);
              await webhook.setUsername("CatchTwo");
              await webhook.setAvatar(
                "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67"
              );
            } else {
              try {
                newWebhook = await message.channel.createWebhook("CatchTwo", {
                  avatar:
                    "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67",
                  reason: "CatchTwo Commands",
                });
              } catch (err) {
                if (err.code == "50013") {
                  newWebhook = config.logWebhook;
                }
              }
              webhook = new Webhook(newWebhook);
              webhook.setUsername("CatchTwo");
              webhook.setAvatar(
                "https://camo.githubusercontent.com/1c34a30dc74c8cb780498c92aa4aeaa2e0bcec07a94b7a55d5377786adf43a5b/68747470733a2f2f6d656469612e646973636f72646170702e6e65742f6174746163686d656e74732f313033333333343538363936363535323636362f313035343839363838373834323438383432322f696d6167652e706e67"
              );
            }
            webhook.sendFile("./data/levelup.json");
          }
        } else if (command === "duel") {
          try {
            message.react("✅");

            const messages = [
              "<@716390085896962058> p --leg --myt --ub --spdiv 31 --atk >20 --hp >10",
              "<@716390085896962058> p --leg --myt --ub --spdiv 31 --spatk >20 --hp >10",
              "<@716390085896962058> p --leg --myt --ub --iv >70 --spdiv 31",
              "<@716390085896962058> p  --spdiv 31 --atk >20 --def >15 --hp >10",
              "<@716390085896962058> p  --spdiv 31 --spatk >20 --spdef >15 --hp >10",
              "<@716390085896962058> p  --triple 31",
              "<@716390085896962058> p  --iv >90",
            ];

            let counter = 0;

            function sendRandomMessage() {
              if (counter < messages.length) {
                const randomDelay = Math.floor(Math.random() * 2000) + 5000;
                setTimeout(() => {
                  message.channel.send(messages[counter]);
                  counter++;
                  sendRandomMessage();
                }, randomDelay);
              }
            }

            sendRandomMessage();
          } catch (err) {
            console.error(err);
            message.react("❌");
          }
        } //Duel Command Contribution by ViwesBot/Akshad :3
      }
    }
  });

  client.on(`rateLimit`, async (message) => {
    console.log(
      `${chalk.redBright(
        "[RATELIMIT]"
      )} Your IP has been ratelimited by Discord.`
    );
    let rateLimitPauses = [`900000`, `1000000`, `1100000`, `1200000`];

    let rateLimitPause =
      rateLimitPauses[Math.floor(Math.random() * rateLimitPauses.length)];

    await sleep(rateLimitPause);
  });

  client.login(token).catch((err) => {
    console.log(
      `${chalk.redBright("[ERROR]")} Invalid token ${chalk.red(token)}`
    );
  });
}

start();

async function start() {
  for (var i = 0; i < config.tokens.length; i++) {
    await Login(config.tokens[i].token, Client, config.tokens[i].guildId);
  }

  log?.send(
    new MessageBuilder()
      .setTitle("Started!")
      .setURL("https://github.com/kyan0045/catchtwo")
      .setDescription(`Found ${config.tokens.length} token(s).`)
      .setColor("#7ff889")
  );
}

process.on("unhandledRejection", (reason, p) => {
  const ignoreErrors = [
    "MESSAGE_ID_NOT_FOUND",
    "INTERACTION_TIMEOUT",
    "BUTTON_NOT_FOUND",
  ];
  if (ignoreErrors.includes(reason.code || reason.message)) return;
  console.log(" [Anti Crash] >>  Unhandled Rejection/Catch");
  console.log(reason, p);
});

process.on("uncaughtException", (e, o) => {
  console.log(" [Anti Crash] >>  Uncaught Exception/Catch");
  console.log(e, o);
});

process.on("uncaughtExceptionMonitor", (err, origin) => {
  console.log(" [AntiCrash] >>  Uncaught Exception/Catch (MONITOR)");
  console.log(err, origin);
});

process.on("multipleResolves", (type, promise, reason) => {
  console.log(" [AntiCrash] >>  Multiple Resolves");
  console.log(type, promise, reason);
});

function randomInteger(min, max) {
  if (min == max) {
    return min;
  }
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(timeInMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeInMs);
  });
}

async function getMentions(ownerIDs) {
  const mentions = ownerIDs
    .filter((ownerID) => ownerID.length >= 18)
    .map((ownerID) => `<@${ownerID}>`)
    .join(", ");

  return mentions;
}
