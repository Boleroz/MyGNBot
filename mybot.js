const args = process.argv.slice(2)
const util = require('util');
const fs = require('fs');
const os = require('os');
const Tail = require('always-tail');
const XMLparser = require('xml2json');
const execFileSync = require('child_process').execFileSync;
const execFile = require('child_process').execFile;
const spawn = require('child_process').spawn;
const zlib = require('zlib');
const https = require('https'); 
const http = require('http');  
const crypto = require('crypto');

var configFile = "./mybot.json";
var regExe = "c:/windows/system32/reg.exe";
var cloudLogs = {}; // will hold the cloud module if defined

var defaultConfig = {
  "MEMUInstances": '{USERDIR}/.MemuHyperv/MemuHyperv.xml',
  "MEMUPath": 'C:/Program Files/Microvirt/MEmu/MemuHyperv VMs',
  "MEMUC": 'C:/Program Files/Microvirt/MEmu/memuc.exe',
  "GNBotSettings": '{USERDIR}/Desktop/GNLauncher/settings.json',
  "GNBotProfile": '{USERDIR}/Desktop/GNLauncher/profiles/actions/{LastProduct}/default.json',
  "GNBotDir": '{USERDIR}/Desktop/GNLauncher/',
  "GNBotLogMask": '{GNBotDir}/logs/log_{N}.txt',
  "GNBotLogMain": '{GNBotDir}/logs/log_main.txt',
  "process_main": 0,
  "saveMyLogs": 1,
  "checkforAPK": 0,
  "checkforGNBUpdate": 1,
  "GNBUpdateURL": "http://goodnightbot.net/gn/gnbot/full/GNLauncher.zip",
  "GNBStats": "./gnbstats.json",
  "apkStart": "https://www.gnbots.com/apk",
  "apkPath": "Last%20Shelter%20Survival/game.apk",
  "apkDest": "./downloaded.apk",
  "apkStatsFile": "./apkstats.json",
  "DuplicateLog": '{USERDIR}/Desktop/MyDiscBot/Logs/LssSessions.log',
  "BackupDir": '{USERDIR}/Desktop/MyDiscBot/Backup/',
  "ConfigsDir": '{USERDIR}/Desktop/MyDiscBot/Configs/',
  "screenshot": 0,
  "screenshotDir": "{USERDIR}/Desktop/MyDiscBot/Screenshots/",
  "nircmd": "{USERDIR}/Desktop/MyDiscBot/nircmd.exe",
  "ffmpeg": "{USERDIR}/Desktop/MyDiscBot/ffmpeg.exe",
  "debug": 0,
  "disabled": 0,
  "killstop": 0,
  "processWatchTimer": 5,
  "processLaunchDelay": 30,
  "offline": 1,
  "GNBotThreads": "3",
  "WatchThreads": 0,
  "announceStatus": 60,
  "postStatusScreenshots": 0,
  "minimumCycleTime": 180,
  "activeProfile": "default",
  "SessionStore": "off",
  "Launcher": "GNLauncher.exe",
  "StartLauncher": "-start",
  "StopLauncher": "-close",
  "processName": "GNLauncher.exe",
  "memuProcessName": "MEmu*",
  "DupeLogMaxBytes": 1048576000,
  "DupeLogMaxBytesTest": 1024,
  "MaxFailures": 4,
  "FailureMinutes": 1,
  "prefix": "!",
  "gametime": "Atlantic/South_Georgia",
  "patternfile": "./patterns.json",
  "reporting": "./reporting.json",
  "messages": "./messages.json",
  "watcherrors": [
    "authfailure",
    "starttimeout",
    "noexist",
    "notdefined",
    "failedwindow",
    "noinclude",
    "unexpected",
    "invalidparam",
    "waitingforqueue"
  ],
  "watcherrorthreshold": 0,
  "enableReboot": 1,
  "manageActiveBasesTime": 0,
  "gameDayMap": {
    "active": 0,
    "0": {"label": "Day 7 DD KE", "profile": "default"},
    "1": {"label": "Day 1 Gather", "profile": "default"},
    "2": {"label": "Day 2 Build", "profile": "default"},
    "3": {"label": "Day 3 Research", "profile": "default"},
    "4": {"label": "Day 4 Hero", "profile": "default"},
    "5": {"label": "Day 5 Train", "profile": "default"},
    "6": {"label": "Day 6 KE", "profile": "default"}
  },
  "GNBotRestartInterval": 0,
  "GNBotRestartFullCycle": 0,
  "manageActiveBasesTime": 0,
  "XXXXPausedMaster": "{USERDIR}/Desktop/Configs/paused.json",
  "process": [
      "runtime",
      "modules",
      "errors",
      "dailies",
      "donation",
      "autoshield",
      "upgrades",
      "store",
      "gather"
  ]
} // defaultConfig 

if ( typeof(args[0]) != 'undefined' && fileExists(args[0]) ) {
  configFile = args[0];
  console.log("Config file set to " + configFile);
} else {
    // it isn't a config file, what are we being told?
    if (typeof(args[0]) != 'undefined' && args[0] === "config") {
        // We are being asked to configure
        console.log("Config mode");
        if (typeof(args[1] == 'undefined')) {
            makeConfigFile(configFile);
        } else {
            makeConfigFile(args[1]);
        }
        process.exit();
    }
}

if ( !fileExists(configFile) ) {
    console.log("Cannot locate my config file " + configFile);
    console.log("Please pass 'config' parameter on commandline to create one.\nEXITING!");
    process.exit(1);
}
// Can't use require if you want to reload values
// var config = require(configFile);
var config = loadJSON(configFile);
// always start offline so that messages get dumped to the console until / unless we connect
config.offline = 1;
// open the log stream as soon as we can
var newLogStream = openNewLog(config.DuplicateLog);

// fix up the log line
var lastGNBotProductUsed = getGNBotLastProductUsed();

if ( typeof(lastGNBotProductUsed) != "undefined" ) {
  config.GNBotProfile = config.GNBotProfile.replace('{LastProduct}', lastGNBotProductUsed);
} else {
  console.log("Could not identify the last game played. Please run and configure GNBot at least once.");
  // Things will most likely fail after here but don't prevent successful manual configuration
  // process.exit(1);
}

// back up current files
backupFiles();

// if there is a valid config that is newer use it
updateNewerMasterConfig();

// Always start with a master config
getMasterConfig(getDesiredActiveConfig(), true); // force a clean version at startup

// XXX Experimental
if ( typeof(config.cloudLogs) != 'undefined' && config.cloudLogs.enabled > 0 ) {
  console.log("Cloud Module configured!")
  console.log(util.inspect(config.cloudLogs));
  cloudLogs = require(config.cloudLogs.source);
  cloudLogs[config.cloudLogs.init](https);
}

// combine the existing and default configs
config = Object.assign(defaultConfig, config);

var debug = config.debug;
var prefix = config.prefix;
var machineid = getMachineUUID();
var processFailures = 0;
var processRunningFailures = 0;
var threadFailures = 0;
var failures = 0;
var success = 0;
var paused = 0;
var grandTotalProcessed = 0;
var totalProcessed = 0;
var elapsedTime = 0;
var averageCycleTime = 0;
var averageProcessingTime = 0;
var pausedTimerHandle = {};
var maintTimerHandle = {};
var msg_order = "";
var LSSConfig = loadJSON("GNBotProfile", config);
var patterns = loadPatterns();
var reporting = loadReporting();
var messages = loadMessages();
var LSSSettings = loadJSON("GNBotSettings", config);
var defaultAPKStats = {
  "size": "0",
  "datestr": "Wed, 01 Apr 2020 00:00:00 GMT"
};
var oldAPK = config.apkDest.replace(".apk",".last.apk");
var apkURL = "";
var apkStats = Object.assign(defaultAPKStats, loadJSON(config.apkStatsFile));

if (( !fileExists(config.nircmd) && !fileExists(config.ffmpeg))) {
  SendIt("screenshots disabled");
  config.screenshot = 0;
  config.postStatusScreenshots = false;
}

if ( typeof(config.screenshotDir) != 'undefined' ) {
  if ( !dirExists(config.screenshotDir)) {
    SendIt("Invalid screenshot directory (screenshotDir) " + config.screenshotDir + " - screenshots disabled");
    config.screenshot = 0;
    config.postStatusScreenshots = false;
  }
}

if ( config.enableReboot == 0) {
  SendIt("Reboot disabled by config (enablereboot)");
}

if ( config.processLaunchDelay > 300 ) {
  SendIt("processLaunchDelay > 300 seconds not supported. using 300 seconds.")
  config.processLaunchDelay = 300;
}

var last_status = "Initializing";
var startTime = new Date();
var oldest_date = new Date(); // nothing can have happened before now

// Used while running to keep track of each active session
// if someone runs more than 11 sessions they should be able to figure out how to fix any errors ;)
var sessions = {
  0: {"name": "System Events", "id": 0, "time": "[00:00]", "state": "Monitoring", "lastlog": "Monitoring System Events", "closed": 0, "processed": 0, logfile:"", tail: undefined},
  1: {"name": "init1", "id": 9999, "time": "timestr", "state": "initializing", "lastlog": "initializing", "closed": 0, "processed": 0, logfile:"", tail: undefined},
  2: {"name": "init2", "id": 9999, "time": "timestr", "state": "initializing", "lastlog": "initializing", "closed": 0, "processed": 0, logfile:"", tail: undefined},
  3: {"name": "init3", "id": 9999, "time": "timestr", "state": "initializing", "lastlog": "initializing", "closed": 0, "processed": 0, logfile:"", tail: undefined},
  4: {"name": "init4", "id": 9999, "time": "timestr", "state": "initializing", "lastlog": "initializing", "closed": 0, "processed": 0, logfile:"", tail: undefined},
  5: {"name": "init5", "id": 9999, "time": "timestr", "state": "initializing", "lastlog": "initializing", "closed": 0, "processed": 0, logfile:"", tail: undefined},
  6: {"name": "init6", "id": 9999, "time": "timestr", "state": "initializing", "lastlog": "initializing", "closed": 0, "processed": 0, logfile:"", tail: undefined},
  7: {"name": "init7", "id": 9999, "time": "timestr", "state": "initializing", "lastlog": "initializing", "closed": 0, "processed": 0, logfile:"", tail: undefined},
  8: {"name": "init8", "id": 9999, "time": "timestr", "state": "initializing", "lastlog": "initializing", "closed": 0, "processed": 0, logfile:"", tail: undefined},
  9: {"name": "init9", "id": 9999, "time": "timestr", "state": "initializing", "lastlog": "initializing", "closed": 0, "processed": 0, logfile:"", tail: undefined},
  10: {"name": "init10", "id": 9999, "time": "timestr", "state": "initializing", "lastlog": "initializing", "closed": 0, "processed": 0, logfile:"", tail: undefined},
  11: {"name": "init11", "id": 9999, "time": "timestr", "state": "initializing", "lastlog": "initializing", "closed": 0, "processed": 0, logfile:"", tail: undefined}
};

// prototype of a base entry
var base = {
  "name": "base1",
  "id" : 0,
  "UUID": "uuid",
  "path": "path",
  "last_time": new Date('1995-12-31T23:59:00'),
  "time": new Date('1995-12-31T23:59:00'),
  "avg_time": 0,
  "total_time": 0,
  "runs": 0,
  "status": "something",
  "storedActiveState": false,
  "actions": [],
  "config": {},
  "cfgBlob": [],
  "activity": [],
  "finished": new Date(),
  "timers": {},
  "processed": false,
  "shield": {},
  "shieldAction": {"cfgParams": {}, "cfgBlob": "" }
};

var gameDays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]

// Holds all the base information
// XXX - TODO - Make this a stored cache so stats persist
var bases = [];

// Maps the name of the base to the instance number in Memu
var nameMap = [];

// maps the entry in bases to memu id
var idMap = [];

var gatherMap = {
};

// Fetch the saved session data if we are using session state
if ( typeof(config.SessionStore) != 'undefined' && config.SessionStore != "off") {
  if (!fileExists(config.SessionStore)) {
    console.log("No session store found at " + config.SessionStore + " running in intial states.");
  } else {
    var tsessions = loadJSON(config.SessionStore);
    // Only pick up the ones we need for the number of sessions we are using
    for (var i = 0; i <= LSSSettings.Threads; i++) {
      sessions[i] = tsessions[i];  
    }
  }
}

buildBaseArray();

loadBaseConfigs();

debugIt(util.inspect(nameMap, true, 10, true), 4);
debugIt(util.inspect(idMap, true, 10, true), 4);

msg_order = getOrderMessage();

showReporting();

// watch for the bot process
if ( config.processWatchTimer > 0) {
  if ( config.processWatchTimer > 100 ) {
    SendIt("NOTE: process watch timer is now in minutes. Using default of 5 minutes");
    config.processWatchTimer = 5;
  }
  setInterval(watchProcess, config.processWatchTimer * 60 * 1000);
} else {
  console.log("```diff\n - WARNING: Not monitoring the bot process```");
}

// move the bot window and keep it on top
setInterval(moveBotWindow, 5 * 60 * 1000); // every 5 minutes

// check the daily configuration settinng
setInterval(checkDailyConfig, 5 * 60 * 1000); // within 5 minutes of reset

// check for a new APK every hour
if ( config.checkforAPK ) {
  SendIt("Checking for an new APK every hour");
  setInterval(checkAPK, 60* 60 * 1000);
}

if ( config.checkforGNBUpdate > 0 ) {
  SendIt("Checking for a new bot every hour");
  setInterval(checkGNB, 60* 60 * 1000);
}

if ( config.manageActiveBasesTime > 0 ) {
  if ( !fileExists(config.PausedMaster)) {
    SendIt("Bad active base management config. (PausedMaster) - disabling.")
    config.manageActiveBasesTime = 0;
  } else {
    // we are actively managing the status of bases. 
    // check for new things to do or if we should stop every 10 minutes
    setInterval(checkBaseActivities, 10 * 60 * 1000);
  }
}

// check the cycle time
if ( config.minimumCycleTime > 0 ) {
  setInterval(checkCycleTime, config.minimumCycleTime * 60 * 1000 / 2);
  if ( config.GNBotRestartInterval <= config.minimumCycleTime ) {
    SendIt("Restart interval less than minimum cycle time. Setting restartinterval to minimumCycleTime + 1.")
    config.GNBotRestartInterval = config.minimumCycleTime + 1;
  }
} else {
  console.log("```diff\n - WARNING: Not monitoring the cycle time. Watch that your instances aren't cycling too fast.```");
}

if ( config.GNBotRestartFullCycle > 0 ) {
  SendIt("```diff\n + Configured restarting GNBot on full cycle (GNBotRestartFullCycle)```");
  if ( config.GNBotRestartInterval > 0 ) {
    config.GNBotRestartInterval = 0;
    SendIt("Disabled restarting on interval (GNBotRestartInterval) because full cycle configured.");
  }
  setInterval(restartFullCycleCheck, 30 * 60 * 1000); // check every 30 minutes. Also handled in cycle time if needed.
}

// when we get here we aren't restarting on full cycle and have a restart interval
if ( config.GNBotRestartInterval > 0 ) {
  setInterval(function() {
    SendIt("```diff\n + Restarting GNBot based on config (GNBotRestartInterval)```")
    stopBot();
    setTimeout(startBot, 10 * 1000);
  }, config.GNBotRestartInterval * 60 * 1000);
};

// Make sure the critical files exist. They will be started with a watch
checkLogs();

// Watch them
watchLogs();

console.log("Pondering what it means to be a bot...");

setTimeout(startup, 5*1000);

function updateNewerMasterConfig() {
  // walk the backup directory looking for the newest loadable > 2kb config file
  // compare that to the currently set master config
  // if they differ prefer the newest one as master
  var backupFiles = getFileList(config.BackupDir);
  var targetFileMask = config.activeProfile + ".json";
  var currentMasterFilePath = config.ConfigsDir + config.activeProfile + ".json";
  var candidateMasterFilePath = currentMasterFilePath;
  if ( !fileExists(currentMasterFilePath) ) { // there is none there by default, just use what GNBot has
    copyFile(candidateMasterFilePath, currentMasterFilePath);
  }
  var currentMaster = fs.statSync(currentMasterFilePath);
  var candidateMaster = currentMaster;
  debugIt("Current master " + targetFileMask, 1);
  debugIt(util.inspect(currentMaster, true, 4 ,true), 2);
  targetBackupFiles = backupFiles.filter(file => file.includes(targetFileMask)); // we only want default.json files
  targetBackupFiles.forEach(file => {
    candidateMasterFilePath = config.BackupDir + file;
    candidateMaster = fs.statSync(candidateMasterFilePath);
    if ( candidateMaster.size > 2048 && candidateMaster.ctimeMs > currentMaster.ctimeMs) { // a < 2k config isn't legit, older doesn't matter
      console.log("Current Master " + currentMasterFilePath + " is " + currentMaster.size + " bytes");
      console.log("Candidate Master " + candidateMasterFilePath + " is " + candidateMaster.size + " bytes");
      debugIt(util.inspect(candidateMaster, true, 4, true), 2);
      if ( currentMaster.size == candidateMaster.size ) {
        debugIt("They match", 1);
      } else {
        // they are different. 
        // If it loads cleanly and is newer, assume it is the now desired configuration
        if ( !loadJSON(candidateMasterFilePath) ) {
          // doesn't load cleanly
          debugIt("Candidate config doesn't load. ignoring.", 1);
        } else {
          // indeed it loads cleanly
          if ( candidateMaster.ctimeMs > currentMaster.ctimeMs ) {
            // it is newer, we just put it there after all
            console.log("Looks like this config was created more recently and loads cleanly, using it as the new master.");
            copyFile(candidateMasterFilePath, currentMasterFilePath, true); // it will exist, needs to be clobbered
          } else {
            console.log("Looks like the existing master config was created more recently. keeping.");
          }
        }
      }
    } else {
      debugIt("candidate file too small or too old. skipping.", 1);
    }
  });
}

function backupFiles() {
 // back up the running config
 copyFile(config.GNBotProfile, config.BackupDir + "default.json." + Date.now());
 copyFile(config.MEMUInstances, config.BackupDir + "MemuHyperv.xml." + Date.now());
}

function startup() {
  if ( !checkProcess(config.processName) ) {
    // bot isn't running, start it
    SendIt("No bot process detected at startup. Starting.");
    startBot();
  }
  if (typeof(config.announceStatus) != 'undefined' && config.announceStatus) {
    var announcePeriod = Number(config.announceStatus);
    if (announcePeriod < 60 ) { announcePeriod = 60; }
    setInterval(function () { SendIt( getStatusMessage())}, announcePeriod * 60 * 1000);
  }
};

console.log("We are off to the races.");

// START CHAT CODE
var chatConfig = {"active": 0};
if ( fileExists('./chatconfig.json')) {
  SendIt("local chat server config found.")
  chatConfig = loadJSON('./chatconfig.json');
  if ( chatConfig.active > 0 ) { 
    SendIt("Local chat server enabled");
  }
} else {
  chatConfig.active = 0; // just so search finds it
  SendIt("local chat server not configured.")
}

// chat includes
var favicon = require('serve-favicon');
var undersscore_str = require('underscore.string');
var express = require('express');
var basicAuth = require('express-basic-auth')
var sockjs = require('sockjs');
var chalk = require('chalk');
var forge = require('node-forge');
var pki = forge.pki;
var log = require('./lib/log.js');
var chatUtils = require('./lib/utils.js');
var pack = require('./package.json');
var path = require('path');

if ( chatConfig.active > 0 ) { // hack in a chat server

  /* Config */
  var port = chatUtils.normalizePort(process.env.PORT || chatConfig.port);
  var host = chatConfig.host || "127.0.0.1";
  var app = express();
  var server;

  /* Variables */
  var lastTime = [];
  var rateLimit = [];
  var currentTime = [];
  var rateInterval = [];

  var chat = sockjs.createServer();
  var clients = [];
  var users = {};
  var bans = [];
  var uid = 1;

  var alphanumeric = /^\w+$/;

  /* Express */
  app.set('port', port);
  app.set('host', host);
  app.set('views', path.join(__dirname, 'views'));
  app.set('view engine', 'ejs');
  app.use(favicon(path.join(__dirname,'public/img/favicon.png')));
  app.locals.version = pack.version;

  /* Routes */
  app.use('/status', function (req, res, next) {
    var currTime = Date.now();
    var htmlResponse = "The current time is " + currTime + "<br>";
    debugIt(htmlResponse, 2);
    htmlResponse += getStatusMessage().replace(new RegExp("\n", "g"), "<br>");
    res.send(htmlResponse);
    // next(); // don't continue to process
  });
  app.use('/statusjson', function (req, res, next) {
    var currTime = Date.now();
    var statsJson = {};
    updateStats();
    statsJson.currTime = currTime;
    statsJson.elapsedTime = elapsedTime;
    statsJson.totalProcessed = totalProcessed;
    statsJson.averageProcessingTime = averageProcessingTime;
    statsJson.averageCycleTime = averageCycleTime;
    statsJson.uptime = os.uptime / 60;
    statsJson.freeMem = os.freemem();
    statsJson.totalMem = os.totalmem();
    statsJson.instances = countProcess(config.memuProcessName);
    statsJson.botInstance = countProcess(config.processName);
    statsJson.grandTotalProcessed = grandTotalProcessed;
    statsJson.oldestTime = oldest_date;
    statsJson.status = config.disabled ? "disabled" : paused ? "paused" : "active";
    debugIt(util.inspect(statsJson, true, 4 ,true), 2);
    res.send(JSON.stringify(statsJson));
    // next(); // don't continue to process
  });
  app.use('/botstatus', function (req, res, next) {
    debugIt("Handling botstatus request", 2);
    res.send(countProcess(config.processName).toString());
    // next(); // don't continue to process
  });
  app.use('/instancesjson', function (req, res, next) {
    debugIt("Handling instances request", 2);
    var currTime = Date.now();
    updateStats()
    var instanceStatus = {};
    instanceStatus.stats = {};
    instanceStatus.stats.currTime = currTime;
    instanceStatus.stats.elapsedTime = elapsedTime;
    instanceStatus.stats.totalProcessed = totalProcessed;
    instanceStatus.stats.averageProcessingTime = averageProcessingTime;
    instanceStatus.stats.averageCycleTime = averageCycleTime;
    instanceStatus.stats.uptime = os.uptime / 60;
    instanceStatus.stats.freeMem = os.freemem();
    instanceStatus.stats.totalMem = os.totalmem();
    instanceStatus.stats.instances = countProcess(config.memuProcessName);
    instanceStatus.stats.botInstance = countProcess(config.processName);
    instanceStatus.stats.total = bases.length;
    instanceStatus.stats.grandTotalProcessed = grandTotalProcessed;
    instanceStatus.stats.oldestTime = oldest_date;
    instanceStatus.stats.status = config.disabled ? "disabled" : paused ? "paused" : "active";
    instanceStatus.instance = {};
    bases.forEach(function(base) {
      var shaID = getSHA256Hash(base.name + base.uuid);
      var shaName = getSHA256Hash(base.name);
      instanceStatus.instance.shaName = {
        unique: shaID,
        name: shaName,
        id: base.id,
        total_time: base.total_time,
        runs: base.runs,
        processedCount: base.processedCount,
        last_time: base.last_time.getUTCMilliseconds(),
        active: base.storedActiveState,
        totalActions: base.activity.length,
      };
    });
    res.send(JSON.stringify(instanceStatus));
    // next(); // don't continue to process
  });
  app.use('/instances', function (req, res, next) {
    debugIt("Handling instances request", 2);
    var currTime = Date.now();
    updateStats()
    var instanceStatus = {};
    instanceStatus.stats = {};
    instanceStatus.stats.currTime = currTime;
    instanceStatus.stats.elapsedTime = elapsedTime;
    instanceStatus.stats.totalProcessed = totalProcessed;
    instanceStatus.stats.averageProcessingTime = averageProcessingTime;
    instanceStatus.stats.averageCycleTime = averageCycleTime;
    instanceStatus.stats.uptime = os.uptime / 60;
    instanceStatus.stats.freeMem = os.freemem();
    instanceStatus.stats.totalMem = os.totalmem();
    instanceStatus.stats.instances = countProcess(config.memuProcessName);
    instanceStatus.stats.botInstance = countProcess(config.processName);
    instanceStatus.stats.total = bases.length;
    instanceStatus.stats.grandTotalProcessed = grandTotalProcessed;
    instanceStatus.stats.oldestTime = oldest_date;
    instanceStatus.stats.status = config.disabled ? "disabled" : paused ? "paused" : "active";
    instanceStatus.instance = {};
    bases.forEach(function(base) {
      var shaID = getSHA256Hash(base.name + base.uuid);
      var shaName = getSHA256Hash(base.name);
      instanceStatus.instance[shaName] = {
        unique: shaID,
        name: shaName,
        id: base.id,
        total_time: base.total_time,
        runs: base.runs,
        processedCount: base.processedCount,
        last_time: base.last_time.getUTCMilliseconds(),
        active: base.storedActiveState,
        totalActions: base.activity.length,
      };
    });
    res.send(JSONsyntaxHighlightHTML(instanceStatus));
    // next(); // don't continue to process
  });
  app.use('/freemem', function (req, res, next) {
    debugIt("Handling freemem request", 2);
    res.send(os.freemem().toString());
    // next(); // don't continue to process
  });
  app.use('/uptime', function (req, res, next) {
    debugIt("Handling uptime request", 2);
    res.send((os.uptime / 60).toString());
    // next(); // don't continue to process
  });
  app.use(chatConfig.url, basicAuth(chatConfig.options), express.static(path.join(__dirname, 'public')));
  app.get(chatConfig.url, function (req, res) {
      res.render('index', {version:pack.version});
  });

  /* Logic */
  chat.on('connection', function(conn) {
      log('socket', chalk.underline(conn.id) + ': connected (' + conn.headers['x-forwarded-for'] + ')');
      rateLimit[conn.id] = 1;
      lastTime[conn.id] = Date.now();
      currentTime[conn.id] = Date.now();

      clients[conn.id] = {
          id: uid,
          un: null,
          ip: conn.headers['x-forwarded-for'],
          role: 0,
          con: conn,
          warn : 0
      };

      users[uid] = {
          id: uid,
          oldun: null,
          un: null,
          role: 0
      };
      
      for(i in bans) {
          if(bans[i][0] == clients[conn.id].ip) {
              if(Date.now() - bans[i][1] < bans[i][2]) {
                  conn.write(JSON.stringify({type:'server', info:'rejected', reason:'banned', time:bans[i][2]}));
                  return conn.close();
              } else {
                  bans.splice(i);
              }
          }
      }
  
      conn.write(JSON.stringify({type:'server', info:'clients', clients:users}));
      conn.write(JSON.stringify({type:'server', info:'user', clients:users[uid]}));
      conn.on('data', function(message) {
          currentTime[conn.id] = Date.now();
          rateInterval[conn.id] = (currentTime[conn.id] - lastTime[conn.id]) / 1000;
          lastTime[conn.id] = currentTime[conn.id];
          rateLimit[conn.id] += rateInterval[conn.id];

          if(rateLimit[conn.id] > 1) {
              rateLimit[conn.id] = 1;
          }

          if(rateLimit[conn.id] < 1 && JSON.parse(message).type != 'delete' && JSON.parse(message).type != 'typing' && JSON.parse(message).type != 'ping') {
            clients[conn.id].warn++;

              if(clients[conn.id].warn < 6) {
                  return conn.write(JSON.stringify({type:'server', info:'spam', warn:clients[conn.id].warn}));
              } else {
                  bans.push([clients[conn.id].ip, Date.now(), 5 * 1000 * 60]);
                  chatUtils.sendToAll(clients, {type:'ban', extra:clients[conn.id].un, message:'Server banned ' + clients[conn.id].un + ' from the server for 5 minutes for spamming the servers'});

                  return conn.close();
              }
          } else {
              try {
                  var data = JSON.parse(message);

                  if(data.type == 'ping') {
                      return false;
                  }

                  if(data.type == 'typing') {
                      return chatUtils.sendToAll(clients, {type:'typing', typing:data.typing, user:clients[conn.id].un});
                  }

                  if(data.type == 'delete' && clients[conn.id].role > 0) {
                      chatUtils.sendToAll(clients, {type:'server', info:'delete', mid:data.message});
                  }

                  if(data.type == 'update') {
                      return updateUser(conn.id, data.user);
                  }

                  if(data.message.length > 768) {
                      data.message = data.message.substring(0, 768);
                      message = JSON.stringify(data);
                  }

                  if(data.type == 'pm') log('message', chalk.underline(clients[conn.id].un) + ' to ' + chalk.underline(data.extra) + ': ' + data.message);
                  else log('message', '[' + data.type.charAt(0).toUpperCase() + data.type.substring(1) + '] ' + chalk.underline(clients[conn.id].un) + ': ' + data.message);

                  handleSocket(clients[conn.id], message);
              } catch(err) {
                  return log('error', err);
              }

              rateLimit[conn.id] -= 1;
          }
      });

      conn.on('close', function() {
          log('socket', chalk.underline(conn.id) + ': disconnected (' + clients[conn.id].ip + ')');
          chatUtils.sendToAll(clients, {type:'typing', typing:false, user:clients[conn.id].un});
          chatUtils.sendToAll(clients, {type:'server', info:'disconnection', user:users[clients[conn.id].id]});
          delete users[clients[conn.id].id];
          delete clients[conn.id];
      });
  });


  /* Functions */
  function updateUser(id, name) {
      if(name.length > 2 && name.length < 17 && name.indexOf(' ') < 0 && !chatUtils.checkUser(clients, name) && name.match(alphanumeric) && name != 'Console' && name != 'System') {
          if(clients[id].un == null) {
            clients[id].con.write(JSON.stringify({type:'server', info:'success'}));
              uid++;
          }

          users[clients[id].id].un = name;
          chatUtils.sendToAll(clients, {
              type: 'server',
              info: clients[id].un == null ? 'connection' : 'update',
              user: {
                  id: clients[id].id,
                  oldun: clients[id].un,
                  un: name,
                  role: clients[id].role
              }
          });
          clients[id].un = name;
      } else {
          var motive = 'format';
          var check = false;

          if(!name.match(alphanumeric)) motive = 'format';
          if(name.length < 3 || name.length > 16) motive = 'length';
          if(chatUtils.checkUser(clients, name) ||  name == 'Console' || name == 'System') motive = 'taken';
          if(clients[id].un != null) check = true;

          clients[id].con.write(JSON.stringify({type:'server', info:'rejected', reason:motive, keep:check}));
          if(clients[id].un == null) clients[id].con.close();
      }
  }

  function handleSocket(user, message) {
      var data = JSON.parse(message);

      data.id = user.id;
      data.user = user.un;
      data.type = undersscore_str.escapeHTML(data.type);
      data.message = undersscore_str.escapeHTML(data.message);
      data.mid = (Math.random() + 1).toString(36).substr(2, 5);

      switch(data.type) {
          case 'pm':
              if(data.extra != data.user && chatUtils.checkUser(clients, data.extra)) {
                  chatUtils.sendToOne(clients, users, data, data.extra, 'message');
                  data.subtxt = 'PM to ' + data.extra;
                  chatUtils.sendBack(clients, data, user);
              } else {
                  data.type = 'light';
                  data.subtxt = null;
                  data.message = chatUtils.checkUser(clients, data.extra) ? 'You can\'t PM yourself' : 'User not found';
                  chatUtils.sendBack(clients, data, user);
              }
              break;

          case 'global': case 'kick': case 'ban': case 'role':
              if(user.role > 0) {
                  if(data.type == 'global') {
                      if(user.role == 3) {
                          return chatUtils.sendToAll(clients, data);
                      } else {
                          data.subtxt = null;
                          data.message = 'You don\'t have permission to do that';
                          return chatUtils.sendBack(clients, data, user);
                      }
                  } else {
                      data.subtxt = null;
                      if(data.message != data.user) {
                          if(chatUtils.checkUser(clients, data.message)) {
                              switch(data.type) {
                                  case 'ban':
                                      var time = parseInt(data.extra);

                                      if(!isNaN(time) && time > 0) {
                                          if(user.role > 1 && chatUtils.getUserByName(clients, data.message).role == 0) {
                                              for(var client in clients) {
                                                  if(clients[client].un == data.message) {
                                                      bans.push([clients[client].ip, Date.now(), time * 1000 * 60]);
                                                  }
                                              }

                                              data.extra = data.message;
                                              data.message = data.user + ' banned ' + data.message + ' from the server for ' + time + ' minutes';
                                              return chatUtils.sendToAll(clients, data);
                                          } else {
                                              data.message = 'You don\'t have permission to do that';
                                              return chatUtils.sendBack(clients, data, user);
                                          }
                                      } else {
                                          data.type = 'light';
                                          data.message = 'Use /ban [user] [minutes]';
                                          return chatUtils.sendToOne(clients, users, data, data.user, 'message')
                                      }
                                      break;

                                  case 'role':
                                      if(data.extra > -1 && data.extra < 4) {
                                          if(user.role == 3) {
                                              var role;
                                              data.role = data.extra;
                                              data.extra = data.message;

                                              if(data.role == 0) role = 'User';
                                              if(data.role == 1) role = 'Helper';
                                              if(data.role == 2) role = 'Moderator';
                                              if(data.role == 3) role = 'Administrator';
                                              data.message = data.user + ' set ' + data.message + '\'s role to ' + role;

                                              chatUtils.sendToOne(clients, users, data, JSON.parse(message).message, 'role');
                                              chatUtils.sendToAll(clients, {type:'server', info:'clients', clients:users});
                                          } else {
                                              data.message = 'You don\'t have permission to do that';
                                              return chatUtils.sendBack(clients, data, user);
                                          }
                                      } else {
                                          data.type = 'light';
                                          data.message = 'Use /role [user] [0-3]';
                                          return chatUtils.sendToOne(clients, users, data, data.user, 'message')
                                      }
                                      break;

                                  case 'kick':
                                      if(user.role > 1 && chatUtils.getUserByName(clients, data.message).role == 0) {
                                          data.extra = data.message;
                                          data.message = data.user + ' kicked ' + data.message + ' from the server';
                                      } else {
                                          data.message = 'You don\'t have permission to do that';
                                          return chatUtils.sendBack(clients, data, user);
                                      }
                                      break;
                              }                            
                              chatUtils.sendToAll(clients, data);
                          } else {
                              data.type = 'light';
                              data.message = 'User not found';
                              chatUtils.sendBack(clients, data, user);
                          }
                      } else {
                          data.message = 'You can\'t do that to yourself';
                          chatUtils.sendBack(clients, data, user);
                      }
                  }
              } else {
                  data.message = 'You don\'t have permission to do that';
                  chatUtils.sendBack(clients, data, user);
              }
              break;

          default:
              chatUtils.sendToAll(clients, data);
              local_message(data);
              break;
      }
  }

  if(!chatConfig.ssl.use) {
      server = http.createServer(app);
  } else {
      if ( !fileExists(chatConfig.ssl.key) || !fileExists(chatConfig.ssl.cert)) {
        generateSSLCert();
      }
      var opt = {
          key: fs.readFileSync(chatConfig.ssl.key),
          cert: fs.readFileSync(chatConfig.ssl.cert)
      };

      server = https.createServer(opt, app);
  }

  server.listen(port, host);
  server.on('error', onError);
  server.on('listening', onListening);

  // we are only looking to prevent casual prying eyes here
  function generateSSLCert() {
    var keys = pki.rsa.generateKeyPair(2048);
    var cert = pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 3);
    var attrs = [{
      name: 'commonName',
      value: chatConfig.host
    }, {
      name: 'countryName',
      value: 'US'
    }, {
      shortName: 'ST',
      value: 'California'
    }, {
      name: 'localityName',
      value: 'ashville'
    }, {
      name: 'organizationName',
      value: 'GNB'
    }, {
      shortName: 'OU',
      value: 'hosted'
    }];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.setExtensions([{
      name: 'basicConstraints',
      cA: true
    }, {
      name: 'keyUsage',
      keyCertSign: true,
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
      dataEncipherment: true
    }, {
      name: 'extKeyUsage',
      serverAuth: true,
      clientAuth: true,
      codeSigning: true,
      emailProtection: true,
      timeStamping: true
    }, {
      name: 'nsCertType',
      client: true,
      server: true,
      email: true,
      objsign: true,
      sslCA: true,
      emailCA: true,
      objCA: true
    }, {
      name: 'subjectAltName',
      altNames: [{
        type: 6, // URI
        value: chatConfig.host
      }, {
        type: 7, // IP
        ip: chatConfig.host
      }]
    }, {
      name: 'subjectKeyIdentifier'
    }]);
    cert.sign(keys.privateKey);
    var privKey = pki.privateKeyToPem(keys.privateKey);
    fs.writeFileSync(chatConfig.ssl.key, privKey);
    var myCert = pki.certificateToPem(cert);
    fs.writeFileSync(chatConfig.ssl.cert, myCert);
  }

  function onError(error) {
      if(error.syscall !== 'listen') {
          throw error;
      }

      var bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

      switch(error.code) {
          case 'EACCES':
              console.error(bind + ' requires elevated privileges');
              process.exit(1);
              break;

          case 'EADDRINUSE':
              console.error(bind + ' is already in use');
              process.exit(1);
              break;

          default:
              throw error;
      }
  }

  function onListening() {
      var addr = server.address();
      var bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
      log('start', 'Listening at ' + bind);
  }

  chat.installHandlers(server, {prefix:'/socket', log:function(){}});
} // config.localchat.active

config.offline = 0;

// END MAIN CODE

function process_log(session, data) {
  debugIt(`Got data of : ${data} for session ${session}`, 3);
  var str = new String(data).trim();

  // new log moves sessions into a distinct file for each and drops the session number, adding it back for simplicity
  // EG: "[12:04 PM]  #3: "
  // logs are also in local time. convert them to 24h game time so there is a reference for time based operations
  str = str.replace(/(\[.*\])/, `[${gameTime(new Date())}]  #${session}:`);
  debugIt(`Converted data to : ${str} for session ${session}`, 3);
  last_status = str;

  newLogStream.write(last_status + "\n", function(err){
    if (err) {
        console.log(err);
    }
  });

  // rollover 
  if ( newLogStream.bytesWritten > config.DupeLogMaxBytes ) {
    newLogStream.end();
    newLogStream = openNewLog(config.DuplicateLog);
  }

  // skip main and system generated messages that are inserted into the pipeline unless desired
  if ( config.process_main < 1 ) {  
    if ( session == 0 || session == 9999 ) {
      return;
    }
  }

  var interesting_log = str.match(patterns.fundamentals.mustcontain);

  // We only care about lines that have a time and session number
  if ( interesting_log == null) {
    // Well, exceptions are always the rule, aren't they. 
    // We also care about at least ONE VERY IMPORTANT log that doesn't have a time and session
    if (typeof patterns.fundamentals.exceptions !== 'undefined') {
      Object.keys(patterns.fundamentals.exceptions).forEach((path, index) => {
        if (str.match(patterns[patterns.fundamentals.exceptions[path]]) !== null) {
          // Replace the time and add the special system session 0
          // Should already have a session with the new log formats
          // str = str.replace(/(\[.*\])/, `[${simpleTime(new Date())} GT]  #0:`);
        }
      });
      interesting_log = str.match(patterns.fundamentals.mustcontain);
      if ( interesting_log == null) { return; }
    } else {
      // Turns out we aren't interested in it
      return;
    }
  }

  debugIt(`last status is : ${last_status}`, 3);

//   var timestr = `${now.getFullYear()}/${(now.getMonth() + 1)}/${now.getDate()} ${str.match(patterns.fundamentals.time)[1]}:00`;
//  var time = new Date(timestr);
  var time = new Date();
  var session = str.match(patterns.fundamentals.sessionnum)[1];

  debugIt(`Time is ${time.toString()}`, 3);
  debugIt(`session is ${session}`, 3);
  sessions[session].time = time;
  sessions[session].lastlog = last_status;
  
	debugIt(util.inspect(patterns), 3);

	Object.keys(patterns['logentries']).forEach((module, index) => {
		if (typeof(patterns['logentries'][module] == 'object')) {
			if (!config.process.includes(module)) return;
			
			Object.keys(patterns['logentries'][module]).forEach((action) => {
				regex = new RegExp(patterns['logentries'][module][action]);

				if (content = str.match(regex)) {
					debugIt(content, 2);
					debugIt(`${module}-${action}`, 2);
					debugIt(patterns['logentries'][module][action], 2);
          
					var message = messages['default'];
					
					if ( typeof messages[module] !== 'undefined' && typeof messages[module][action] !== 'undefined' && messages[module][action] ) {
						message = messages[module][action];
					}
					message = messages['pre'] + message + messages['post'];

					if (module == 'runtime' && (action == 'startingbase' || action == 'startedbase')) {
            var baseIndex = nameMap[content[1]];
            debugIt("fetched base index of " + baseIndex + " for " + content[1] + " with ID of " + bases[baseIndex].id, 2);
            sessions[session].id = bases[baseIndex].id;
            debugIt("resulting session #" + session + " ID is " + sessions[session].id, 2);
						switch (action) {
							case 'startingbase': sessions[session].state = "Starting"; break;
							case 'startedbase':
                sessions[session].closed = 0;
                sessions[session].state = "Started";
                sessions[session].name = content[1];
                bases[baseIndex].name = content[1];
								bases[baseIndex].last_time = bases[baseIndex].time;
								bases[baseIndex].time = time;
                bases[baseIndex].activity = [];
								if (bases[baseIndex].last_time < oldest_date) {
									message = message.replace('{last_run}', 'unknown');
								} else {
									message = message.replace('{last_run}', timeDiffHoursMinutes(bases[baseIndex].time, bases[baseIndex].last_time) + ' ago');
                }
                sessions[session].cumulativeerrors = 0; // reset for each session, if a session gets hung we will ultimately restart gnbot
								break;
						}
            // save off the session state on account changes
            if (typeof(config.SessionStore) != 'undefined' && config.SessionStore != "off") { // XXX - follow up on this. can be cleaner
              storeJSON(sessions, config.SessionStore);
            }
          }
          if ( module == 'runtime' && action == 'skipaction') {
// the way logs work this will always be behind, still deciding if a video helps
//            takeWindowScreenshot(sessions[session].name, true);
          }
          if ( module == 'errors' && config.watcherrors.includes(action) ) {
            // These are the errors we determined should be counted, when we hit the threshold we should restart gnbot
            sessions[session].cumulativeerrors++;
            if ( config.watcherrorthreshold > 0 && sessions[session].cumulativeerrors > config.watcherrorthreshold ) {
              SendIt("Too many cumulative watched errors. restarting GNBot");
              sessions[session].cumulativeerrors = 0;
              restartBot();
            }
          }
					if (module == 'runtime' && action == 'finishedbase') {
						sessions[session].state = "Closed";
						sessions[session].closed += 1;
            var runtime = 'Unknown Duration';
						if (sessions[session].closed > 1) {
              // We have already reported on this
              return;
            }
            sessions[session].processed += 1;
            grandTotalProcessed += 1;
            var base_id = nameMap[sessions[session].name];
            // If we start in the middle of a run, sessions may not yet be filled out.
            if (base_id != 9999 && typeof(bases[base_id]) != 'undefined') {
              bases[base_id].total_time += (time - bases[base_id].time);
              bases[base_id].runs += 1;
              bases[base_id].processed = true;
              bases[base_id].processedCount += 1;
              runtime = timeDiffHoursMinutes(time, bases[base_id].time)
              // a case exists where things just go to shit and instances never start or start and fail really fast
              // this will catch those cases and after too many simply reboot the system
              // NOTE: With the addition of account skips this can trigger often, set FailureMinutes to 0 to disable
              if (timeDiffMinutes(time, bases[base_id].time) < config.FailureMinutes) {
                let strFail = messages.misc.startfailure;
                strFail = strFail.replace('{failures}', failures);
                strFail = strFail.replace('{runtime}', runtime);
                SendIt( strFail);
                failures++; // track that we had a failure
                success = 0; // every time a failure happens we reset the success counter. 
                if (failures > config.MaxFailures) {
                  strFail = messages.misc.maxfailures;
                  strFail = strFail.replace('{maxfailures}', config.MaxFailures);
                  strFail = strFail.replace('{failures}', failures);
                  SendIt( strFail);
                  debugIt("TOO MANY INSTANCE FAILURES, REBOOTING", 2);
                  reboot(90);
                  stopBot();
                }
              } else {
                success++; // If we have successfully started half as many times as max failures we assume all is okay
                if (success > Math.ceil(Number(config.MaxFailures)/2)) {
                  failures = 0;
                }
              }
            }
          }
          message = message.replace('{runtime}', runtime);
					message = message.replace('{full}', str);
					message = message.replace('{sessionnum}', session);
					message = message.replace('{base.name}', sessions[session].name);
					message = message.replace('{base.id}', sessions[session].id);
					message = message.replace('{time}', gameTime(time));
					message = message.replace('{localtime}', localTime(time));
					message = message.replace('{gametime}', gameTime(time));

          var strnum = 0;
					content.forEach(element => {
						message = message.replace('{s'+strnum+'}', element);
						strnum++;
          });
          
          if ((action in reporting[module]) && ((reporting[module][action] !== "OFF") && (reporting[module][action] !== 0))) {
            SendIt(message);
          } else {
            debugIt(`Reporting for ${module}->${action} was not enabled.
              ${message}`, 1);
          }

          // XXX Experimental
          if ( typeof(config.cloudLogs) != 'undefined' && config.cloudLogs.enabled > 0 ) {
            let base_id = nameMap[sessions[session].name];
            if ( typeof(base_id) != 'undefined' ) { // if we start mid-run things aren't known until we see a start log
              let base = {
                "name": bases[base_id].name,
                "id": bases[base_id].id,
                "machineid": machineid,
                "last_time": bases[base_id].last_time,
                "uuid": bases[base_id].UUID, 
                "active": bases[base_id].storedActiveState
              };
              try { // don't bail if something in the module goes wrong
                cloudLogs[config.cloudLogs.submit](config.cloudLogs, base.uuid, base, module+":"+action, str, message);
              } catch {};
            }
          }

          // keep track of the activity for this base
          // if we start in the middle of a run these might not yet be known
          if ( typeof(bases[nameMap[sessions[session].name]]) == 'undefined' ) {
            return;
          }
          if ( typeof(bases[nameMap[sessions[session].name]].activity) == 'undefined' ) {
            // this one should never happen in practice
            return;
          }
          bases[nameMap[sessions[session].name]].activity.push(last_status);          
          return;
				}
			});
		}
	});
};

process.on('uncaughtException', function (err) {
  SendIt("FYI: Whoah an uncaughtExecption error. If you don't see me again things went terribly wrong.");
  console.log(err);
})

function local_message(message) {
  if (!message.message.startsWith(prefix)) { return; }
  process_message(message.message, message.user);
}

function process_message(message, owner = "anyone") {
  var now = new Date();
  const commandArgs = message.slice(prefix.length).trim().split(/ +/g);
  const command = commandArgs.shift().toLowerCase();
    
  if (command === "status") {
    SendIt( getStatusMessage());
  } else
  if (command === "status:detailed") {
    SendIt( getStatusMessage(true));
  } else
  if (command === "status:active") {
    SendIt( getBaseActiveStatusMessage());
  } else
  if ( command === "status:processed") {
    SendIt( getProcessedBases());
  } else
  if (command === "order") {
    SendIt("Accounts are handled in this order");
     // XXX - prettify this at some point
    SendIt( msg_order);
  } else
  if (command === "actions" || command === "activity") {
    if (typeof(nameMap[commandArgs[0]]) != 'undefined') { 
      let activities = prettifyActionLog(bases[nameMap[commandArgs[0]]].activity);
      debugIt(util.inspect(bases[nameMap[commandArgs[0]]].activity), 4);
      SendIt("Activity for " + bases[nameMap[commandArgs[0]]].name + ":\n" + activities);
    } else {
      SendIt("Usage: " + command + " <basename> - NOTE: Name must match exactly"); 
    }
} else
if (command === "help") {
  SendIt( `Common Commands:
!reboot: Reboot the host system if permissions allow. 
  By default will schedule it for 120 minutes from issuance. 
  Pass seconds as a parameter to use a different time. 
  EG: "!reboot 60" to reboot in a minute.

!abort: Abort any pending reboot.

!stop: Cleanly stop and close the bot and all running instances.

!start: Start the bot at the last running instance.

!pause: Cleanly stop and close the bot and all running instances for
  a period of time and then start it again. By default pauses 
  for 15 minutes. Pass minutes as a parameter to use a different time. 
  EG: "!pause 60" to pause for an hour.  

!resume: Immediately resume a paused bot.

!status: Print the current status and some basic stats. 
  Note: Effort is still needed to make this accurate all the time 
  however if there is inaccuracy it is obvious. 

!order: Print the order instances should be processed in. 
  Note: This diverges when running multiple sessions over time 
  so watch out if you run for days without starting. 

!actions: Print the action log captured for a base, requires a base name that must match exactly. 
  EG: "!actions myfarm1"

!threads: Change the number of threads in use by GNBot

!profile: Change the running profile (configuration) of GNBot. 
  EG: !profile KE will use the configuration saved in configs directory named KE.json

!interfaces: Dump information about the network interfaces

!memory: Display memory usage information

!uptime: Display the uptime

!cpu: Dump CPU information

!close: Closes an instance by name as if you clicked the X on the window. EG: Close <name> - NOTE: Requires nircmd.

!killbot: forcefully terminates the GNBot process. Needed when the bot process hangs in the background. 

!killmemu: forcefully terminates ANY MEmu process. 

`);
}

// Begin priv commands
// You are not the owner if your ID doesn't match the configured ID
// if the ID is undefined or anyone or everyone then let anyone do it
if(typeof(config.ownerID) != 'undefined' && ( owner !== config.ownerID && config.ownerID != "anyone" && config.ownerID != "everyone" ) ) return;

  if (command === "owner") {
    SendIt( config.Quip);
  } else
  if ( command === "machineid" ) {
    SendIt( machineid);
  } else 
  if (command === "threads" || command === "sessions") {
    var threads = commandArgs[0];
    if ( Number.isNaN(threads) ) {
      SendIt("Invalid sessions value, must be a number.");
    } else {
      config.GNBotThreads = threads;
      restartBot();
    }
  } else
  if (command === "active" || command === "profile") {
    var profile = commandArgs[0];
    if ( !fileExists(config.ConfigsDir + profile + ".json") ) {
      SendIt("Invalid profile, profile must exist in " + config.ConfigsDir + " keeping " + config.activeProfile + " profile active.");
    } else {
      config.activeProfile = profile;
      // disable daily configs
      if ( typeof(config.gameDayMap) != 'undefined' ) {
        SendIt("Manual profiles in use. Disabled automatic daily profiles " + profile);
        config.gameDayMap.active = 0;
      }
      storeJSON(config, configFile);
      SendIt("Updated active profile to " + profile);
      restartBot();
    }
  } else
  if (command === "maintenance" || command === "maint") {
    var start = commandArgs[0];
    var duration = commandArgs[1];
    if (Number.isNaN(start)) {
      SendIt("Invalid start parameter " + start);
      return;
    }
    if (Number.isNaN(duration)) {
      SendIt("Invalid duration parameter " + duration);
      return;
    }
    SendIt("Scheduling downtime for maintenance in " + start + " minutes for a duration of " + duration + " minutes. \n Issue !maintenance:cancel to cancel.");
    maintTimerHandle = setTimeout(pauseBot, start * 60 * 1000, duration);
  } else
  if (command === "maintenance:cancel" || command === "maint:cancel") {
    clearTimeout(maintTimerHandle);
    SendIt("Canceled maintenance window");
  } else
  if (command === "close") {
    var targetWindow = commandArgs[0];
    if ( typeof(nameMap[targetWindow]) == 'undefined' ) {
      SendIt("No configured instances with the name " + targetWindow);
      return;
    }
    SendIt("Closing window " + targetWindow);
    closeWindow(targetWindow);
  } else
  if (command === "reboot") {
    SendIt("```diff\n + Reboot requested```");
    paused = commandArgs[0];
    if ( Number.isNaN(paused) ) {
      paused = 120;
    } 
    reboot(paused);
    stopBot(); // don't let a stop interrupt a reboot
  } else
  if (command === "abort") {
    SendIt("Aborting reboot request.");
    abortReboot();
  } else
  if (command === "restart") {
    SendIt("Restart requested");
    restartBot();
  } else
  if (command === "start") {
    var startMsg = "Start requested";
    // we have a base parameter
    if ( typeof(commandArgs[0]) != 'undefined' ) {
      if ( typeof(nameMap[commandArgs[0]]) == 'undefined') { // have a param but it doesn't match a base
        SendIt("Base Name to start with (" + commandArgs[0] + ") must be an identical match");
        return;
      } else {  // we have a parameter and a match
        startMsg = "Start requested at base " + commandArgs[0];
      }
    } 
    SendIt( startMsg);
    paused = 0;
    startBot(getDesiredActiveConfig(), commandArgs[0]);
  } else 
  if (command === "stop") {
    SendIt("Stop requested");
    paused = 1;
    stopBot();
  } else 
  if (command === "updategnb") {
    SendIt("GNB update requested. This may take up to 5 minutes.");
    paused = 1;
    stopBot();
    setTimeout(updateGNB, 10 * 1000);
    setTimeout(killProcess(config.processName), 60 * 1000);
    setTimeout(startBot, 180 * 1000);
  } else 
  if (command === "killbot") {
    SendIt("Kill of " + config.processName + " requested");
    killProcess(config.processName);
  } else 
  if (command === "killmemu") {
    SendIt("Kill of " + config.memuProcessName + " requested");
    killProcess(config.memuProcessName);
  } else 
  if (command === "pause") {
    SendIt("Pause requested");
    paused = commandArgs[0];
    force = commandArgs[1] ? 1 : 0;
    if (Number.isNaN(paused) || Number(paused) < 1 ) {
      paused = 15;
    } 
    pauseBot(paused, force);
  } else 
  if (command === "disable") {
    SendIt("Disable requested. Use !enable to enable again.");
    paused = 1;
    config.disabled = 1;
    storeJSON(config, configFile);
    stopBot();
  } else 
  if (command === "enable") {
    SendIt("Bot enabled! Starting.");
    paused = 0;
    config.disabled = 0;
    storeJSON(config, configFile);
    startBot();
  } else 
  if (command === "resume") {
    clearTimeout(pausedTimerHandle);
    paused = 0;
    resumeBot();
  } else 
  if (command === "interfaces") {
    SendIt( JSON.stringify(os.networkInterfaces(), null, 2));
  } else 
  if (command === "memory") {
    let fmem = os.freemem();
    let tmem = os.totalmem();
    SendIt( Math.round((fmem / tmem)*100) + "% of " + tmem + " bytes memory available.");
  } else 
  if (command === "uptime") {
    SendIt("My uptime is " + os.uptime() / 60 + " minutes");
  } else 
  if (command === "cpu") {
    SendIt( JSON.stringify(os.cpus(), null, 2));
  } else 
  if (command === "stopwait") {
    SendIt("Stop requested");
    paused = 1;
    stopBotWait();
  } else 
  if (command === "reload:patterns" || command === "reload:all" ) {
    patterns = loadPatterns();
    SendIt("Patterns reloaded at " + localTime(now));
  } else 
  if (command === "reload:messages" || command === "reload:all" ) {
    messages = loadMessages();
    SendIt("Messages reloaded at " + localTime(now));
  } else 
  if (command === "reload:reporting" || command === "reload:all" ) {
    reporting = loadReporting();
    SendIt("Reporting reloaded at " + localTime(now));
  }
}

// make the order message
function getOrderMessage() {
  var msg = "";
  bases.forEach(function(element) {
    msg += `ID: ${element.id} -> Name: ${element.name}` + "\n";
    debugIt(`${element.id}:${element.name}`, 2);
  });
  debugIt(`Order Message assembled as 
  ${msg}`, 1);
  return msg;
}

// show what our reporting config is
function showReporting() {
  if ( !config.debug ) { return;}
  for (let [key, value] of Object.entries(patterns['logentries'])) {
    for (let [k1, v1] of Object.entries(patterns['logentries'][key])) {
      // defined and not off or zero means not disabled
        if ((typeof reporting[key] !== 'undefined' ) && ((reporting[key][k1] !== "OFF") && (reporting[key][k1] !== 0))) {
        debugIt(`Reporting enabled for ${key}->${k1} with ${v1} `, 1);
      } else {
        debugIt(`Reporting not enabled for ${key}->${k1} with ${v1}`, 1);
      }
    }
  }
}

// appears that LSS reads and sorts then builds the config. 
function getMemuInLSSAccoutOrder() {
  // Fetch the Memu instances
  // turns out we cannot trust the memu instance XML to have unique entries. 
  // Going directly to the VM directory and reading all of the VMs in instead. filesystem enforces unique... 

  var acct_order = [];
  var memuImages = fs.readdirSync(config.MEMUPath);
  for (let val of memuImages) {
    var memu_id = val == "MEmu" ? 0 : parseInt(val.split("_")[1], 10);
    var storage_path = config.MEMUPath + val + "/" + val + ".memu";
    var instanceData = loadMemuXML(storage_path);
    var uuid = instanceData.MemuHyperv.Machine.uuid;
    var created_date = uuid.split("-")[0].replace("{", "");
    acct_order.push({"id": memu_id, "path": storage_path, "created": created_date, "uuid": uuid});
  }
  acct_order.sort(function(a,b) { return a.id-b.id});
  return acct_order;
}

function buildBaseArray() {
  var memu_reference = getMemuInLSSAccoutOrder();
  // for (baseNum=0; baseNum<LSSConfig.length; baseNum++) {
  for (baseNum=0; baseNum<memu_reference.length; baseNum++) {
    debugIt("Handling MEMU entry of " + baseNum + "\n" + util.inspect(memu_reference[baseNum], true, 4, true), 2);
    debugIt("LSS Config for corresponding entry " + util.inspect(LSSConfig[baseNum], true, 4 ,true), 3);
    if ( typeof(LSSConfig[baseNum].Account) != 'undefined' && typeof(LSSConfig[baseNum].Account.Id) != 'undefined') { // memu can have them but not be configured in GNBot
      var id = LSSConfig[baseNum].Account.Id;
      bases.push(Object.create(base));
      bases[baseNum]._id = id;
      bases[baseNum].id = id;
      bases[baseNum].UUID = memu_reference[baseNum].uuid;
      bases[baseNum].path = memu_reference[baseNum].path;
      bases[baseNum].created = memu_reference[baseNum].created;
      bases[baseNum].activity = {};
      // track which entry in the array is for this base by ID
      idMap[id] = baseNum;
      if (!fs.existsSync(bases[baseNum].path)) {
        console.log("Missing MEMU instance config file " + bases[baseNum].path);
        process.exit(1);
      } 
      var memuConf = loadMemuXML(bases[baseNum].path);
      for (let val of memuConf.MemuHyperv.Machine.Hardware.GuestProperties.GuestProperty) {
        // debugIt(util.inspect(val),2);
        switch (val.name) {
          case "name_tag":
            bases[baseNum].name = val.value;
            // track which entry in the array is for this base by name
            nameMap[bases[baseNum].name] = baseNum;
            break;
        }
      }
      debugIt(util.inspect(bases[baseNum], true, 10, true), 4);
    } else { // memu has it but it isn't configured in GNBot
      // NOT sure what happens when I do this... Going to try it and see.
      // these instances are in memu but not configured in GNBot
      debugIt("Discovered unconfigured instance " + baseNum + ". Making fake instance.", 2);
      var id = baseNum + 9999;
      bases.push(Object.create(base));
      bases[baseNum]._id = memu_reference.id;
      bases[baseNum].id = memu_reference.id;      
      bases[baseNum].UUID = memu_reference[baseNum].uuid;
      bases[baseNum].path = memu_reference[baseNum].path;
      bases[baseNum].created = memu_reference[baseNum].created;
      bases[baseNum].processed = false;
      bases[baseNum].skippable = false;
      bases[baseNum].processedCount = 0;
      bases[baseNum].storedActiveState = false;
      bases[baseNum].skippable = true;
      // make sure the LSS config has what is needed to not cause us problems
      LSSConfig[baseNum] = { "Account": {
        "Email": "youremail@gmail.com",
        "Pwd": "",
        "Id": id,
        "Instance": 0,
        "Setup": false,
        "Active": false,
        "EmailSlot": 1.0,
        "Custom": {}
      },
      "List": [] };
    }
  }
}

// load messages and local overrides
function loadMessages() {
  var configFile = config.messages;
  var messages = loadJSON(configFile);
  configFile.replace(".json",".local.json");
  if ( fileExists(configFile)) {
    var localMessages = loadJSON(configFile);
    messages = Object.assign(messages, localMessages);
  }
  return messages;
}

// load up local reporting
function loadReporting() {
  var configFile = config.reporting;
  var messages = loadJSON(configFile);
  configFile = configFile.replace(".json",".local.json");
  if ( fileExists(configFile)) {
    var localMessages = loadJSON(configFile);
    messages = Object.assign(messages, localMessages);
  }
  return messages;
}

// load up patterns
function loadPatterns() {
  var configFile = config.patternfile;
  var messages = loadJSON(configFile);
  configFile.replace(".json",".local.json");
  if ( fileExists(configFile)) {
    var localMessages = loadJSON(configFile);
    messages = Object.assign(messages, localMessages);
  }
  return messages;
}

// Load up the base configuration 
function loadBaseConfigs() {
  var paused_config = {};
  if ( config.manageActiveBasesTime > 0 ) {
    paused_config = loadJSON("PausedMaster", config);
  }
  for ( let a = 0; a < bases.length; a++ ) { // LSSConfig and bases are both ordered the same and have the same id entry
    debugIt("Sanity check: " + bases[a].name + ":" + bases[a].id + ":" + LSSConfig[a].Account.Id, 1);
    debugIt(util.inspect(LSSConfig[a], true, 7, true), 4);
    debugIt("Handling Account number " + a + " ID of " + bases[a].id, 2);
    bases[a].processed = false; // always set to not processed on new load
    bases[a].processedCount = 0;
    if ( config.manageActiveBasesTime > 0 ) { // managing active state. set to configured state.
      bases[a].storedActiveState = paused_config[a].Account.Active;
    } else {
      bases[a].storedActiveState = LSSConfig[a].Account.Active;
    }
    if ( typeof(LSSConfig[a].List) != 'undefined' ) { // account isn't configured
      bases[a].actions = LSSConfig[a].List;
      debugIt("Grabbed the actions for account ID " + bases[a].id + ":" + bases[a].name, 1)
      for (i=0; i<bases[a].actions.length; i++) {
        if ( bases[a].storedActiveState == false) { continue; } // we can skip inactive ones
        var action = bases[a].actions[i];
        debugIt("Processing " + action.Script.Name + " for " + bases[a].name, 1);
      }
      debugIt(util.inspect(bases[a].actions, true, 10, true), 4);
    } else {
      debugIt("Account ID " + bases[a].id + ":" + bases[a].name + " has no actions", 1);
      bases[a].storedActiveState = false;
    }
    debugIt(util.inspect(bases[a], true, 10, true), 4);
    loadBaseTimers();
  }
}

// returns an array of base IDs that will expire with N minutes
function activateBases(minutes = config.manageActiveBasesTime) {
  var baseList = getSkipExpireList(minutes); // will contain the base index for bases that should go active
  var msg = "Active bases this run are\n";
  for (i=0; i<bases.length; i++) {
    debugIt(bases[i].name, 1);
    bases[i].processed = false; // none of them have been processed yet
    bases[i].processedCount = 0;
    let active = ( baseList.includes(i)) && bases[i].storedActiveState;  // only includes Skip & default active base numbers in the bases array
    LSSConfig[i].Account.Active = active;
    if ( active ) { // only display the ones that are active
      msg += bases[i].name + " : " + (active ? "unpaused" : "paused") + "\n";
    }
  }
  SendIt("making " + bases[baseList[0]].id + " : " + bases[baseList[0]].name + " the starting base");
  setGNBotLastAccount(bases[baseList[0]].id); // set it to an active instance
  SendIt( msg);
  return LSSConfig;
}

function takeVideoScreenShot(post = false) {
  if ( config.disabled ) { return; }
  // ffmpeg.exe -f gdigrab -framerate 1 -i desktop -vframes 1 output.jpeg
  if ( !config.screenshot ) {return;} // If they aren't allowed don't do them
  var screenshotName = config.screenshotDir + "screenshot" + Date.now() + ".jpg";
  execFileSync(config.ffmpeg, ["-f", "gdigrab", "-framerate", "1", "-i", "desktop", "-vframes", "1", screenshotName], {"timeout":5000});
}

function takeVideo(post = false, length = 30, targetWindow = "desktop") {
  if ( config.disabled ) { return; }
  // XXX - TODO: make the command string configurable
  if ( length > 180 ) {
    SendIt("video longer than 3 minutes not supported")
    length = 180;
  }
  if ( targetWindow != "desktop" ) {
    targetWindow = "title=(" + targetWindow + ")";
    // XXX
    SendIt("window video is currently broken, let me know if you need it");
    targetWindow = "desktop";
  }

  // ffmpeg.exe -y -rtbufsize 150M -f gdigrab -framerate 30 -draw_mouse 1 -i desktop -c:v libx264 -r 30 -preset ultrafast -tune zerolatency -crf 28 -pix_fmt yuv420p -movflags +faststart "output.mp4"
  if ( !config.screenshot ) {return;} // If they aren't allowed don't do them
  var screenshotName = config.screenshotDir + "screenVideo" + Date.now() + ".mp4";
//   execFileSync(config.ffmpeg, ["-y", "-rtbufsize", "150M", "-f", "gdigrab", "-framerate", "30", "-draw_mouse", "1", "-i", targetWindow, "-c:v", "libx264", "-r", "30", "-preset", "ultrafast", "-tune", "zerolatency", "-crf", "28", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-vframes", length * 30, screenshotName], {"timeout":(length + (length/10)) * 1000});
  execFileSync(config.ffmpeg, ["-y", "-rtbufsize", "150M", "-f", "gdigrab", "-framerate", "30", "-draw_mouse", "1", "-i", targetWindow, "-c:v", "libx264", "-r", "30", "-preset", "ultrafast", "-tune", "zerolatency", "-crf", "28", "-movflags", "+faststart", "-vframes", length * 30, screenshotName], {"timeout":(length + (length/10)) * 1000});
}

function takeScreenshot(post = config.postStatusScreenshots) {
  if ( config.disabled ) { return; }
  if ( !config.screenshot ) {return;} // If they aren't allowed don't do them
  // XXX - TODO: make the command string configurable
  var screenshotName = config.screenshotDir + "screenshot" + Date.now() + ".jpg";
  execFileSync(config.nircmd, ["savescreenshotfull",screenshotName], {"timeout":5000});
}

function takeWindowScreenshot(WindowTitle = "Lss", post = config.postStatusScreenshots) {
  if ( config.disabled ) { return; }
  if ( !config.screenshot ) {return;} // If they aren't allowed don't do them
  // XXX - TODO: make the command string configurable
  var screenshotName = config.screenshotDir + "screenshot" + Date.now() + ".jpg";
  activateWindow(WindowTitle);
  execFileSync(config.nircmd, ["savescreenshotwin",screenshotName], {"timeout":5000});
}

function moveWindow(windowTitle = "Lss", X=0, Y=0, W=500, H=500) {
  if ( config.disabled ) { return; }
  execFileSync(config.nircmd, ["win","setsize","ititle", windowTitle, X, Y, W, H], {"timeout":5000});
  activateWindow(windowTitle);
}

function activateWindow(windowTitle = "Lss") {
  if ( config.disabled ) { return; }
  execFileSync(config.nircmd, ["win","activate","ititle", windowTitle], {"timeout":5000});
}

function closeWindow(windowName) {
  if ( config.disabled ) { return; }
  execFileSync(config.nircmd, ["win", "close", "ititle", windowName], {"timeout":5000});
}

function updateStats() {
  // Of course this should be passed around and such but...
  // track these globally so we can check in on them any time
  elapsedTime = timeDiffMinutes(new Date(), startTime);
  totalProcessed = getProcessedBaseCount(); // use the tracked processed flag
  averageProcessingTime = Math.round(( elapsedTime * config.GNBotThreads ) / totalProcessed);
  averageCycleTime = Math.round((Number(getActiveBaseCount()) / Number(config.GNBotThreads)) * averageProcessingTime);
}

function resetStats() {
  // reset start time
  startTime = new Date();  
  // reset # processed in sessions on start
  for (var num in sessions) {
    if (sessions[num].id != 9999) {
      sessions[num].processed = 0;      
    }
  }
}

function checkCycleTime() {
  updateStats()
  if ( config.minimumCycleTime > 0 && averageCycleTime > 0 && ( ( getProcessedBaseCount() + config.GNBotRestartFullCycle ) > getActiveBaseCount() ) ) {
    if ( !paused && ( averageCycleTime < config.minimumCycleTime) ) { 
      SendIt("```diff\n - **CAUTION**: A full cycle has completed too fast. Pausing to make up the difference.```");
      pauseBot(config.minimumCycleTime - averageCycleTime, 0);
    } else {
      // okay, not up against minimums but still need to see if we are restarting on full cycle
      restartFullCycleCheck();
    }
  }
}

function restartFullCycleCheck() {
  updateStats();
  if  (!paused && config.GNBotRestartFullCycle > 0 && ( getProcessedBaseCount() + config.GNBotRestartFullCycle ) > getActiveBaseCount() ) { 
    SendIt("```diff\n + Restarting GNBot on full cycle completion by config (GNBotRestartFullCycle)```")
    restartBot(); 
  }
}

function getStatusMessage(detailed = false) {
  var msg = "";
  var botStatus = "disabled";
  var now = Date.now();
  updateStats();
  if ( config.disabled > 0 ) { 
    msg = "Management of the bot is currently disabled.\nUse !enable to enable it.";
    return msg;
  } else {
    if ( paused ) {
      botStatus = "paused";
      msg = "The bot is currently paused for " + timeoutMinutesRemaining(pausedTimerHandle) + " more minutes\n";
    } else {
      botStatus = "active";
    }
  }

  msg += "The bot is " + botStatus + " and has been working for you for " + elapsedTime + " minutes since last start\n";
  msg += "A total of " + totalProcessed + " instances have been handled in " + elapsedTime + " minutes\n";
  msg += "A grand total of " + grandTotalProcessed + " instances have been handled since I started minotoring on " + oldest_date + "\n";
  if ( detailed ) { 
    msg += "=============================================\n";
    for (var num in sessions) {
      if (sessions[num].id != 9999) {
        msg += `Session #${num} has processed ${sessions[num].processed} bases in ${timeDiffHoursMinutes(new Date, startTime)} and is processing **${sessions[num].name}**` + "\n";
      }
    }
    msg += "=============================================\n";
    msg += getProcessedBases() + " \n";
  }
  return msg;
}

function debugIt(msg = "", level = 1) { 
  if (debug >= level) {
    console.log("DEBUG : " + msg);
    newLogStream.write(msg + "\n", function(err){
      if (err) {
          console.log(err);
      }
    });
  };
}

function fileExists(file) {
  try
  {
    fs.accessSync(file);
  }
  catch (err)
  {
      return false;
  }
  return true;
}

function dirExists(file) {
  return fileExists(file);
}

function prettifyActionLog(activity) {
  if ( typeof(activity) == 'undefined') { return "No actions.";}
  var retMsg = "";
  activity.forEach(action => retMsg += action + "\n")
  if ( retMsg != "" ) { return retMsg; } else { return "No actions."; };
}

function storeJSON(data, path) {
  try {
    fs.writeFileSync(path, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
  }
}

function loadJSON(path, configObj){
  var filePath = path;
  // if we are given a configObj assume it is a config
  // and that path will define the path to the key in the config
  if (typeof(configObj) != 'undefined' ) {
    filePath = configObj[path];
  } else {
    configObj = ""
  }

  if (!fileExists(filePath)) {
    console.log(configObj + " File not found " + filePath);
    return false;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(err);
    return false;
  }
}

function SendIt(msg = "no message provided") {
	if (config.offline) {
    console.log("OFFLINE : " + msg);
  } else {
    // for hacking in a local chat server
    if ( chatConfig.active > 0 ) {
      var maxMsgSize = msg.length >= 795 ? 795 : msg.length;
      var htmlMsg = msg.replace(new RegExp("\n", "g"), "<br>");
      var localMsg = {"message": "", "type": "bot", "role": 0, "client": {"id": 1, "oldun": null, "role": 0, "un": "MyBot"} };
      var bufSent = 0;
      while (bufSent < msg.length) {
        maxMsgSize = (msg.length - bufSent) >= 795 ? 795 : msg.length - bufSent;
        localMsg.message = htmlMsg.substring(bufSent, bufSent + maxMsgSize);
        chatUtils.sendToAll(clients, localMsg);
        bufSent += maxMsgSize;
       }
    }
  }
  if ( config.saveMyLogs > 0 ) {
    newLogStream.write(msg + "\n", function(err){
      if (err) {
          console.log(err);
      }
    });
  }
	return true;
}

function loadMemuXML(path) {
  try {
    return JSON.parse(XMLparser.toJson(fs.readFileSync(path, 'utf8')));
  } catch (err) {
    console.error(err);
    return false;
  }
}

function getFileList(directory) {
  return fs.readdirSync(directory);
}
     
// read in storage files and populate the base entries with the timers
function loadBaseTimers() {
  var storageDirectory = config.GNBotDir + "storage/";
  var files = getFileList(storageDirectory);
  var storageFile = "";
  var now = Date.now();

  for (x=0; x < bases.length; x++) { 
    storageFile = storageDirectory + x + "_data.json";
    if ( fileExists(storageFile) ) {
      // using bases means we don't need instance but there are cases where we would so not changing the underlying implementation
      [instance, instanceStorage] = loadStorageFile(storageFile);
    } else { // there is no storage. fill in what we need.
      instance = bases[x].id;
      instanceStorage = {};
      instanceStorage.SkipAccountMinutes = 9; // if we see a 9 in minutes suggests we created it
      instanceStorage.SkipAccountTime = (now - (4*60*60*1000)) / 1000; // four hours ago converted to unixtime so it can be converted to epoc below
    }
    if ( !instanceStorage.LSSAutoShield ) { 
      instanceStorage.LSSAutoShield = {      
        index: 'LastShield',
        skips: {
          LastShield: { timestamp: 0, duration: 0, type: 'SkipFixedTime' }
        }
      };
    };

   bases[x].timers = instanceStorage;
   // not currently stored in ms
   bases[x].timers.SkipAccountTime = bases[x].timers.SkipAccountTime * 1000;
   debugIt("Instance: " + bases[x].name, 2);
   debugIt("Skip set at "  + new Date(bases[x].timers.SkipAccountTime), 2);
   debugIt("Skip set for " + (bases[x].timers.SkipAccountMinutes) + " minutes", 2);
   debugIt("Skip ends at " + new Date(bases[x].timers.SkipAccountTime + (bases[x].timers.SkipAccountMinutes) * 60 * 1000), 2);
  } 
} // loadBaseTimers

// returns index of base entries that should be active
function getSkipExpireList(within = 60) { // one hour
  var nextBases = [];
  loadBaseTimers();  // make sure we are working with the latest skip timers
  for ( i=0; i<bases.length; i++ ) {
    debugIt("Checking expire for instance " + i + " instanceID of " + bases[i].id, 1);
    if ( bases[i].storedActiveState == false ) { continue; } // this is simply off by default 
    var expires = bases[i].timers.SkipAccountTime + (bases[i].timers.SkipAccountMinutes * 60 * 1000);
    var cutoff = Date.now() + ( within * 60 * 1000 )
    if ( expires < cutoff ) {
      nextBases.push(i);
      debugIt("Skip will expire for instance: " + bases[i].name,1);
      debugIt("  Skip ends at " + new Date(bases[i].timers.SkipAccountTime + (bases[i].timers.SkipAccountMinutes) * 60 * 1000), 1);
    }
  }
  return nextBases;
}

function checkBaseActivities() {
  var done = true; // false says done can never be done
  updateStats();
  if ( !paused && countProcess(config.memuProcessName) == 0 && elapsedTime > 30 ) { // running 30 minutes and not processing a base while not paused
    SendIt("Something is wrong with processing. Trying again.");
    if ( countProcess(config.processName) > 0 ) {
      SendIt("Killing GNBot");
      killProcess(config.processName);
    }
    execBot(config.processLaunchDelay); // maybe the start account didn't get set right, just start the bot and see what happens
    done = false;
  }
  for ( i=0; i<bases.length; i++ ) {
    if ( bases[i].storedActiveState == false || LSSConfig[i].Account.Active == false ) { 
      // these bases aren't enabled right now
      continue; 
    } 
    // if any of them isn't done it isn't done
    // processed is set when processing is finished in the logs
    done = done && bases[i].processed;
  }
  // nothing left to do, look at doing new things. 
  if ( done ) { 
    SendIt("All active bases processed. Looking for things to do")
    paused = 1;
    stopBot();
    var moreBases = getSkipExpireList(1);
    if ( moreBases.length > 0 ) {
      // we have something to do
      // startBot will get it done. 
      SendIt("There are more bases to process. Starting.")
      paused = 0;
      setTimeout(startBot, 5*1000);
    } else {
      SendIt("Nothing to do right now. Idling");  // the default 10 minute check cycle will handle starting again
    }
  }
}

function getBaseActiveStatusMessage() {
  var msg = ""
  loadBaseTimers();
  bases.forEach(base => {
    msg += base.name + ": " + LSSConfig[nameMap[base.name]].Account.Active + "\n";
  });
  return msg;
}

function getBaseSkipTimesMessage() {
  var msg = "";
  loadBaseTimers();
  for ( i=0; i<bases.length; i++ ) {
    expires = new Date(bases[i].timers.SkipAccountTime + (bases[i].timers.SkipAccountMinutes) * 60 * 1000);
    now = Date.now();
    if ( expires > now ) {
      msg += bases[i].name + ": Base skip expires in " + timeDiffHoursMinutes(expires, now) + "\n";
    } else {
      msg += bases[i].name + ": Base has no active skip" + "\n";
    }
  }
  return msg;
}

function getProcessedBases(all = false) {
  var msg = "base : default active : currrent active : processed";
  for ( i=0; i<bases.length; i++ ) {
    if ( all || LSSConfig[i].Account.Active ) { // If we want all include otherwise just the active ones
      msg += bases[i].name + " : " + bases[i].storedActiveState + " : " + LSSConfig[i].Account.Active + " : " + bases[i].processed + "\n";
    }
  }
  return msg;
}

function getProcessedBaseCount() {
  var count = 0;
  for ( i=0; i<bases.length; i++ ) {
    if ( bases[i].processed == true ) {
      count++;
    }
  }
  return count;
}

function getActiveBaseCount() {
  var count = 0;
  for ( i=0; i<bases.length; i++ ) {
    if ( LSSConfig[i].Account.Active == true ) {
      count++;
    }
  }
  return count;
}

function loadStorageFile(file) {
  debugIt("Loading requested storage file " + file, 1);
  var instanceMask = new RegExp(/.*\/(\d+)_data\.json/)
  var instance = Number(file.match(instanceMask)[1]);
  var instanceData = {};
  debugIt("Got instance number of " + instance,1);
  if ( Number.isInteger(instance) ) {
    instanceData = loadJSON(file);
    if ( !instanceData ) {
      SendIt("A problem with " + file + " was identified.");
      copyFile(file, config.BackupDir + "/" + instance + "_data.json" + Date.now(), true);
      fs.unlink(file, (err) => {
        if (err) {
          console.log(err);
        };
        SendIt("Deleted " + file + ". You can find a copy in the backup dir.");
      });
    } else {
      return [instance, instanceData] ;
    }
  }
};


function timeDiffHoursMinutes(t1, t2) {
  var time_diff = Math.floor(Math.abs(t1 - t2)/1000/60); // millisec, sec => stored in minutes
  var diff_hours = Math.floor(time_diff/60); 
  var diff_minutes = time_diff - (diff_hours * 60);
  return diff_hours + " hours and " + diff_minutes + " minutes";
}

function timeDiffMinutes(t1, t2) {
  return Math.floor(Math.abs(t1 - t2)/1000/60); // millisec, sec => stored in minutes
}

function gameTime (date) {
  return simpleTime(date, config.gametime) + " GT";
}

function localTime (date) {
  return simpleTime(date, config.localtime) + " LT";
}

function gameDay(time = Date.now()) {
  return new Date(gameTimeInMS(time)).getUTCDay();
}

function GameDate (date) {
  return new Date(gameTimeInMS);
}

function gameTimeInMS(date = new Date()) {
var gameOffsetFromUTC = 2*60*60*1000*-1; // 2 hours, 60 minutes per hour, 60 seconds per minute, 1000 milliseconds per second behind UTC
return new Date(Date.now() + gameOffsetFromUTC).getTime();
}

function simpleTime(date, timezone = config.localtime){
  var options = {hour12: false, hour: "numeric", minute: "numeric", timeZone: timezone};
  return new Intl.DateTimeFormat("en-US", options).format(date);
}

function checkProcess(process_name, cb){
  if ( config.disabled ) { return; }
  debugIt("looking for " + process_name, 2);
  return execFileSync('c:/windows/system32/tasklist.exe').indexOf(process_name) > 0;
}

function getMachineUUID() {
  // wmic CsProduct Get UUID
  if ( config.disabled ) { return; }
  debugIt("fetching the machine UUID", 2);
  var retVal = execFileSync('c:/windows/system32/wbem/wmic', ["CsProduct","Get","UUID"]);
  return retVal.toString().match(new RegExp(/(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})/, "g"));
}

function killProcess(process_name, cb){
  if ( config.disabled ) { return; }
  var killResult = "";
  debugIt("looking for " + process_name, 2);
  if ( execFileSync('c:/windows/system32/tasklist.exe').indexOf(process_name) > 0 ) {
    debugIt("Found processes. Killing them.", 2);
    killResult = execFileSync('c:/windows/system32/taskkill.exe', ["/F", "/T", "/IM", process_name]); // force, children, matching name
    SendIt( killResult); 
  };
}

function getGNBotLastProductUsed() {
  var lastProduct = "";
  debugIt("Fetching LastProduct from HKCU\\Software\\GNBots", 1);
  // reg.exe QUERY HKCU\Software\GNBots /v LastProduct
  var regResult = execFileSync(regExe, ["QUERY", 'HKCU\\Software\\GNBots', "/v", "LastProduct"]).toString();
  debugIt("Fetched " + util.inspect(regResult, true, 4, true), 2);
  lastProduct = regResult.match(new RegExp("\\s+LastProduct\\s+REG_SZ\\s+(\\w+)"))[1];
  SendIt("The last game used was " + lastProduct);
  return lastProduct;
}

function setGNBotLastAccount(accountID) {
  if ( config.disabled ) { return; }
  SendIt("setting start instance to " + accountID);
  debugIt("Editing registry key HKEY_CURRENT_USER/Software/GNBots and setting LastAccount to " + accountID, 2);
  execFileSync(regExe, ["ADD", 'HKCU\\Software\\GNBots', "/f", "/v", "LastAccount", "/t", "REG_DWORD", "/d", accountID]);
  debugIt("Set GNBot LastAccount to " + accountID, 1);
}

// XXX - TODO: Test what happens if it isn't there at all
function deleteGNBotLastAccount() {
  if ( config.disabled ) { return; }
  debugIt("Deleting registry key HKEY_CURRENT_USER/Software/GNBots", 2);
  execFileSync(regExe, ["DELETE", 'HKCU\\Software\\GNBots', "/f", "/v", "LastAccount"]); // delete the old value
}

function countProcess(process_name, cb){
  if ( config.disabled ) { return; }
  debugIt("looking for " + process_name, 2);
  var procRegex = new RegExp(process_name, "g");
  var result = execFileSync('c:/windows/system32/tasklist.exe').toString().match(procRegex);
  var number = 0;
  if ( result && typeof(result.length) != "undefined" ) {
    number = result.length;
  }
  debugIt("Tracking " + number + " memu instances", 2);
  return number;
}

function getFilesizeInBytes(filename) {
  var stats = fs.statSync(filename);
  var fileSizeInBytes = stats["size"];
  return fileSizeInBytes;
}

function renameFile(oldFile, newFile) {
  fs.renameSync(oldFile, newFile);
}

function checkLogs() {
  sessions[0].logfile = config.GNBotLogMain;
  if ( !fileExists(sessions[0].logfile)) {
      // make the file and let things start normally
      // if the bot is running it'll just start writing to it, if it isn't, then it'll get started
      fs.writeFile(sessions[0].logfile, "", function (err) {
        if (err) throw err;
        console.log("Created " + sessions[l].logfile);
      });
  }

  for (l = 1; l <= LSSSettings.Threads; l++) {
    sessions[l].logfile = config.GNBotLogMask.replace('{N}', l);
    if (!fileExists(sessions[l].logfile)) {
      console.log("Missing log file " + sessions[l].logfile);
      // make the file and let things start normally
      // if the bot is running it'll just start writing to it, if it isn't, then it'll get started
      fs.writeFile(sessions[l].logfile, "", function (err) {
        if (err) throw err;
        console.log("Created " + sessions[l].logfile);
      });
    } 
  }  
}

function watchLogs() {
  for (l = 1; l <= LSSSettings.Threads; l++) {
  }
  SendIt("Watching " + LSSSettings.Threads + " sessions");
  // watch the main log as session 0
  sessions[0].tail = new Tail(config.GNBotLogMain);
  sessions[0].tail.on('line', function(data) { process_log(0, data)});
  sessions[0].tail.on('error', function(data) {
    console.log("error:", data);
  });
  // watching more than we need doesn't matter, watching less does.
  for (t = 1; t <= LSSSettings.Threads; t++) {
    let x = t; // don't ref it
    if ( typeof(sessions[x].tail) == 'undefined' ) {
      sessions[x].tail = new Tail(sessions[x].logfile);
      sessions[x].tail.on('line', function(data) { process_log(x, data)});
      sessions[x].tail.on('error', function(data) {
        console.log("error:", data);
      });
      debugIt("watch set up for " + sessions[x].logfile, 1);
    } else {
      sessions[x].tail.unwatch();
      debugIt("UNWatched " + sessions[x].logfile, 1 );
      sessions[x].tail = new Tail(sessions[x].logfile);
      sessions[x].tail.on('line', function(data) { process_log(x, data)});
      sessions[x].tail.on('error', function(data) {
        console.log("error:", data);
      });
      debugIt("new watch set up for " + sessions[x].logfile, 1);
    }
  }
  for (l = 1; l <= LSSSettings.Threads; l++) {
    sessions[l].tail.watch();
    debugIt("Watching " + sessions[l].logfile, 1 );
  }
  SendIt("Watching " + LSSSettings.Threads + " sessions");
}

function openNewLog(logPath) {
  if (fileExists(logPath)) {
    let newLog = logPath + (Date.now());
    renameFile(logPath, newLog);
    compressFile(newLog);
  }
  return fs.createWriteStream(logPath);
}

function compressFile(targetFile) {
  const gzip = zlib.createGzip();
  const inp = fs.createReadStream(targetFile);
  const out = fs.createWriteStream(targetFile + ".gz");
  
  inp.pipe(gzip)
    .on('error', (err) => {
      console.log(err);
    })
    .pipe(out)
    .on('error', (err) => {
      console.log(err);
    })
    .on('finish', () => {
      out.end();
      console.log("Archived " + targetFile + " as " + targetFile + ".gz");
      fs.unlinkSync(targetFile);
    });
}

function getDesiredActiveConfig() {
  // if configured, make sure we use the right config. 
  if ( typeof(config.gameDayMap) != 'undefined' && config.gameDayMap != null && config.gameDayMap.active > 0) {
    let gameDayOfWeek = gameDay();
    if ( config.activeProfile != config.gameDayMap[gameDayOfWeek].profile) {
      config.activeProfile = config.gameDayMap[gameDayOfWeek].profile;
    }
  }
  // If that config file doesn't exist revert to default
  if ( !fileExists(config.ConfigsDir + config.activeProfile + ".json") ) {
    SendIt("```Cannot find config for " + config.activeProfile + " using default.```");
    config.activeProfile = "default";
    config.gameDayMap[gameDay()].profile = config.activeProfile; // that file doesn't exist, stop trying to find it. 
  }
  return config.activeProfile;
}

function getMasterConfig(targetConfig = getDesiredActiveConfig(), force = false) {
  var myMsg = force ? "Forced using " : "Using ";
  myMsg += targetConfig + " as configuration";
  var fullSourceConfigPath = config.ConfigsDir + targetConfig + ".json";
  if ( !fileExists(fullSourceConfigPath) ) {
    SendIt("```diff\n- WARNING: Cannot find config for " + targetConfig + " using default.```");
    targetConfig = "default";
    fullSourceConfigPath = config.ConfigsDir + targetConfig + ".json";
  }
  if ((getFilesizeInBytes(config.GNBotProfile) != getFilesizeInBytes(fullSourceConfigPath)) || force == true) {
    debugIt(myMsg, 2);
    SendIt( myMsg);
    copyFile(fullSourceConfigPath, config.GNBotProfile, 1); // the actual config to use
    LSSConfig = loadJSON(config.GNBotProfile);
  } else {
    SendIt("Config looks okay. Using existing config.");
  }
}

function setConfig(targetConfig = getDesiredActiveConfig(), force = false) {
  // Always reference the master now
  getMasterConfig(targetConfig, force);
  // make sure we have the latest information
  LSSConfig = loadJSON(config.GNBotProfile);
  loadBaseConfigs();
  if ( config.manageActiveBasesTime > 0 ) {
    SendIt("Updating pause state for instances");
    storeJSON(activateBases(), config.GNBotProfile);
  }
}

function setThreads(threads) {
  var activeCount = getActiveBaseCount();
  if (LSSSettings.Threads != threads || threads > activeCount - 1 ) { 
    debugIt(util.inspect(LSSSettings, true, 10, true), 4);
    if ( threads > activeCount - 1 ) {
      threads = activeCount - 1;
      if ( threads < 1 ) { threads = 1; }
      SendIt("Insufficient active instances adjusting sessions to " + threads + "\n");
    } else {
      SendIt("Set sessions to " + threads);
    }
    LSSSettings.Threads = threads;
    storeJSON(LSSSettings, config.GNBotSettings);
    debugIt(util.inspect(LSSSettings, true, 10, true), 4);
    SendIt("Updating log monitoring for " + threads + " sessions");
    checkLogs();
    watchLogs();
  }
}

function pauseBot(minutes = 15, force = 0) {
  var minutesLeft = timeoutMinutesRemaining(pausedTimerHandle);
  if (Number.isNaN(minutes) ) {
    minutes = 15;
  } 
  // make sure we don't have any other starts scheduled before the one we are requesting
  if ( ( minutesLeft < minutes ) || force ) {
    // This is a longer pause so reset things
    clearTimeout(pausedTimerHandle);
  } else {
    // we should be paused already with a longer pause
    SendIt("Already paused for " + minutesLeft + " more minutes.");
    return;
  }
  SendIt("Pausing bot for " + minutes + " minutes.");
  pausedTimerHandle = setTimeout(resumeBot, minutes * 60 * 1000);
  paused = 1;
  stopBot();
}

function restartBot() {
  paused = 1;
  stopBot();
  setTimeout(resumeBot, 30 * 1000); // give time for the bot to actually shut down before trying to restart it
}

function resumeBot() {
  paused = 0;
  startBot();
}

function timeoutMinutesRemaining(timeoutHandle) {
  return Math.ceil(timeoutRemaining(timeoutHandle) / 60);
}

function timeoutRemaining(timeoutHandle) {
  var timeLeft = 0;
  if ( typeof(timeoutHandle) == 'undefined' || 
       typeof(timeoutHandle._idleStart) == 'undefined' || 
       typeof(timeoutHandle._idleTimeout) == 'undefined' ) {
    SendIt("Apparently there is no paused timeout scheduled");
    // there is no timeout
    timeLeft = 0;
  } else {
    timeLeft = Math.ceil((timeoutHandle._idleStart + timeoutHandle._idleTimeout)/1000 - process.uptime());
    if ( Number.isNaN(timeLeft) ) {
      // this should never actually happen at this point. if it does say why.
      var msg = "Hmm. doesn't seem right. \nminutes left calcualted as " + timeLeft;
      msg += "\n" + "idleStart is: " + timeoutHandle._idleStart;
      msg += "\n" + "IdleTImeout is: " + timeoutHandle._idleTimeout;
      msg += "\n" + "calcualted idle time is: " + (timeoutHandle._idleStart + timeoutHandle._idleTimeout)/1000;
      msg += "\n" + "uptime is: " + process.uptime();
      msg += "\n" + "time left calcualtes as: " + (timeoutHandle._idleStart + timeoutHandle._idleTimeout)/1000 - process.uptime();
      msg += " or a ceil of " + Math.ceil((timeoutHandle._idleStart + timeoutHandle._idleTimeout)/1000 - process.uptime());
      SendIt( msg);
      timeLeft = Infinity;
    }
  }
  return timeLeft;
}

function startBot(targetConfig = getDesiredActiveConfig(), targetBase = "" ){
  clearTimeout(pausedTimerHandle);
  resetStats();
  if (checkProcess(config.processName)) {
    paused = 0; // if the bot is running we are not paused
    return;
  }
  setThreads(config.GNBotThreads);
  setConfig(targetConfig); // fixes up the config and sets the first active base as the one to start with
  // if we were passed a base to start, start at that base
  if ( typeof(nameMap[targetBase]) != 'undefined' && targetConfig.includes(nameMap[targetBase])) {
    setGNBotLastAccount(bases[nameMap[targetBase]].id); // this overrides what was done in activateBases through setConfig
  } else {
    if ( typeof(nameMap[targetBase]) != 'undefined' ) { // actual base but not active, don't override setConfig
      SendIt("Base " + nameMap[targetBase] + " is not currently active. Using first active base.")
    }
  }
  execBot(config.processLaunchDelay);
}

function execBot(time = 5) {
  if ( config.disabled ) { return; }
  SendIt("Starting bot in " + time + " seconds");
  setTimeout(function() {
    const options = {
      cwd: config.GNBotDir, // work in the bot root
      env: process.env, // use default environemnt
      detached: true,  // detach the process
      stdio: ['ignore', 'ignore', 'ignore'] // we don't need stdio handles
    };
    var bot = spawn(config.GNBotDir + "/" + config.Launcher, [config.StartLauncher], options);
    bot.on('error', (err) => {
      console.error('Failed to start subprocess. Check permissions.');
      SendIt("FAILED TO START BOT. CHECK PERMISSIONS.");
    });
    bot.unref();  
    paused = 0;
  }, time * 1000);
}

function updateGNB() {
  if ( config.disabled ) { return; }
  var myCwd = process.cwd();
  process.chdir(config.GNBotDir);
  const child = execFile(config.GNBotDir + config.Launcher, [config.UpdateLauncher], (error, stdout, stderr) => {
    if (error) {
      throw(error);
    }
  });
  process.chdir(myCwd);
}

function stopBot() {
  if ( config.disabled ) { return; }
  if ( config.killstop > 0 ) {
    killProcess(config.processName);
    if ( checkProcess(config.memuProcessName) ) {
      killProcess(config.memuProcessName);
    }
    return;
  } else { // added above for GNBots that won't close
    var myCwd = process.cwd();
    process.chdir(config.GNBotDir);
    const child = execFile(config.GNBotDir + config.Launcher, [config.StopLauncher], (error, stdout, stderr) => {
      if (error) {
        throw(error);
      }
    });
    process.chdir(myCwd);
  }
}

function stopBotWait() {
  if ( config.disabled ) { return; }
  var myCwd = process.cwd();
  process.chdir(config.GNBotDir);
  execFileSync(config.GNBotDir + config.Launcher, [config.StopLauncher], {"timeout":15000}); // 15 sec should be ample time
  process.chdir(myCwd);
}

function abortReboot() {
  if ( config.disabled ) { return; }
  const child = execFile('C:/Windows/System32/shutdown.exe', ['/a'], (error, stdout, stderr) => {
    if (error) {
      throw(error);
    }
  });
  SendIt("A REBOOT HAS BEEN ABORTED.");
}

function reboot(seconds = 120) {
  if ( config.enableReboot < 1 ) {
    SendIt("Reboot requested but reboot is disabled. Check enableReboot in config.");
    return;
  }
  paused = 1;
  SendIt("A REBOOT HAS BEEN REQUESTED.");
  const child = execFile('C:/Windows/System32/shutdown.exe', ['/r', '/f', '/t', seconds], (error, stdout, stderr) => {
    if (error) {
      throw(error);
    }
  });
  SendIt("```diff\n + REBOOTING IN " + seconds + " SECONDS! Issue !abort to stop the reboot.```");
  if ( checkProcess(config.processName) ) { // mode to end so that if bot doesn't stop it doesn't interrupt reboot
    stopBot(); // don't use a stopwait
  }
}

function checkDailyConfig() {
  if ( paused || config.disabled ) {
    return;
  }
  // first thing we do is check to see if we need to change configurations
  // We do this here because this happens frequently enough to know to switch
  if ( typeof(config.gameDayMap) != 'undefined' && config.gameDayMap.active > 0 ) {
    let gameDayOfWeek = gameDay();
    if ( config.activeProfile != getDesiredActiveConfig()) {
      SendIt("Time for a new profile (" + config.gameDayMap[gameDayOfWeek].label + ") " + config.activeProfile );
      restartBot();
    }
  }
}

function moveBotWindow() {
  // always keep the window where we want it
  if (typeof(config.moveGNBotWindow) != 'undefined') {
    let X = config.moveGNBotWindow[0] || 0; // just in case
    let Y = config.moveGNBotWindow[1] || 0;
    let W = config.moveGNBotWindow[2] || 500;
    let H = config.moveGNBotWindow[3] || 500;
    moveWindow("Lss", X, Y, W, H);
  }  
}

function watchProcess () {
  // if we have been disabled by !disable don't start things
  if ( config.disabled > 0 ) { return; }

  // the whole point of being here is that we want to know the bot is running
  if ( checkProcess(config.processName) ) {
    if ( !paused ) {
      // all is well
      processFailures = 0;
      processRunningFailures = 0;
    } else {
      processRunningFailures += 1;
      // If the bot is paused AND we see a bot process, something is off. 
      // it could be someone is working with the bot manually so not good to kill it outright
      // it could be that the bot is slow to shutdown
      // instead call out that the bot process is in fact running while we think it should be closed. 
      if ( processRunningFailures % 2) { // don't be too noisy
        SendIt("```diff\n- WARNING: BOT IS RUNNING WHILE PAUSED!!. REPEATED MESSAGES INDICATES POSSIBLE HUNG PROCESS?!?!```");
        SendIt("```diff\n- You will need to issue !killbot if you are not manually working with the bot.```");
      }
    }
  } else { // a bot process is not runnnig
    if ( !paused ) {    // we aren't paused and the bot isn't running
      processFailures += 1;
      takeScreenshot(config.postStatusScreenshots);
      process_log(9999, "[00:00 AM] CRITICAL: BOT NOT RUNNING!!!!!!! Attempting to start.");
      if ( processFailures > 2 ) { // someone using killbot will get a lot of @ mentions. only @ someone when it is consistent failure. 
        SendIt("@" + config.ownerHandle + " - ATTENTION");
        SendIt("```diff\n- CRITICAL: BOT NOT RUNNING!!!!!!! Attempting to start.```");
      }
      startBot();
    } else {
      if ((processFailures % 10) == 0) {
        SendIt("```diff\n + STARTING OF BOT PAUSED for " + timeoutMinutesRemaining(pausedTimerHandle) + " more minutes. use !start to start it.```");
      }
    }
    
    // couldn't start the bot too many times, time for a reboot
    if (processFailures > config.MaxFailures) {
      takeScreenshot(config.postStatusScreenshots);
      process_log(9999, "[00:00 AM] CRITICAL: Too many process failures (" + processFailures + " ), rebooting");
      SendIt("```diff\n- Too many process failures (" + processFailures + " ), rebooting```");
      reboot(60);
    }
  }

  // Now watch the number of instances and make sure we aren't in a consistenly mismatched state.
  // With the addition of active base management (pause, unpause) this can be expected to happen
  // and at times the bot will go idle. If we hit zero sessions active just pause the bot.
  if ( !paused && typeof(config.WatchThreads) != 'undefined' && config.WatchThreads > 0) {
      // this can be very transient with 4 instances stopping at once and taking 2 minutes to start each
      // be a bit more patient in counting as a failure
      if (countProcess(config.memuProcessName) > (config.GNBotThreads / 2) ) { // 50% tolerance
        if (threadFailures > 0) { // running at half capacity at least, count as success
          threadFailures--;
        }
    } else {
      threadFailures++;
      if ( (threadFailures > config.MaxFailures) && config.manageActiveBasesTime > 1 ) {
        takeScreenshot(config.postStatusScreenshots);        
        process_log(9999, "[00:00 AM] ***NOTE***: Instances doesn't match sessions. This is normal in active base management.");
        SendIt("```diff\n + ***NOTE***: Instances doesn't match sessions. This is normal in active base management.```");
        if ( countProcess(config.memuProcessName) ) {
          process_log(9999, "[00:00 AM] ***NOTE***: Bot is idled. Pausing for 10 minutes.");
          SendIt("```diff\n + ***NOTE***: Bot is idled. Pausing for 10 minutes. This is normal in active base management.```");
          pauseBot(10);
        }
      } else 
      if ((threadFailures > config.MaxFailures) && config.WatchThreads > 1 ) {
        takeScreenshot(config.postStatusScreenshots);
        process_log(9999, "[00:00 AM] ***WARNING***: Too many session failures (" + threadFailures + " ), rebooting");
        SendIt("```diff\n- Too many session failures (" + threadFailures + " ), rebooting```");
        reboot(60);
      } else 
      if ( threadFailures > config.MaxFailures ) {
        process_log(9999, "[00:00 AM] ***WARNING***: Instances doesn't match sessions (" + threadFailures + " faulires). Monitoring.");
        SendIt("```diff\n - ***WARNING***: Instances doesn't match sessions (" + threadFailures + " faulires). Monitoring.```");
        takeScreenshot(config.postStatusScreenshots);
      }
    } 
  }
}

function copyFile (source, dest, clobber = false) {
  if (fileExists(source)) {
    if (!fileExists(dest) || clobber) {
      fs.copyFileSync(source, dest);
      console.log(source + ' was copied to ' + dest);
      return;
    } 
  }
  console.log('Could not copy file ' + source + ' to ' + dest);
}

function checkGNB() {
  isNewGNBAvailable(config.GNBUpdateURL, config.GNBStats).then( function(newStats) {
    debugIt("A new GNB is available \n" + util.inspect(newStats), 1);
    SendIt("A new GNB is available. Triggering an update. Things should return to normal within 5 minutes.");
    // really don't feel like promisfying right now
    stopBot(); // first stop the running bot
    setTimeout(updateGNB, 10 * 1000); // now initiate an update 10 seconds later
    setTimeout(killProcess, 60 * 1000, config.processName); // give that a minute to run and then kill it off
    setTimeout(startBot, 180 * 1000); // and then start again
  });
}

function checkAPK() {
  getRealAPKurl(config.apkStart).then(function(path) {
    apkURL = path + config.apkPath;
    isNewAPKAvailable(apkURL, apkStats).then( function(newStats) {
      var isNewFile = false;
      debugIt("A new APK is available \n" + util.inspect(newStats), 1);
      copyFile(config.apkDest, oldAPK, true);
      saveFilefromURL(apkURL, config.apkDest, function(e) {
        if ( e ) { 
          debugIt(e, 1); 
        } else {  
          isNewFile = getSHA256FileHash(oldAPK) != getSHA256FileHash(config.apkDest);
        }
        if ( isNewFile ) {
          SendIt("@everyone - disabling bot. A new APK is available at " + config.apkDest);
          SendIt("It is strongly encouraged the new APK be installed before using !enable. Failure to do so may result in having to complete the tutorials again.");
          stopBot();
          config.disabled = 1;
          storeJSON(config, configFile);
        }
      }), function(e) { // saveFile
        console.log(e);
      };
    }, function(e) { // isNewAPK
      console.log(e);
    });
  }, function(e) { // getrealurl
    console.log(e)
  });
}

function getRealAPKurl(root) { 
  var http_or_https = http;
  if (/^https:\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/.test(root)) {
      http_or_https = https;
  } 
  return new Promise( function(resolve, reject) {
    http_or_https.get(root, function(response) {
    var headers = JSON.stringify(response.headers);
    switch(response.statusCode) {
      case 200: 
        resolve(root);
      case 301:
      case 302:
      case 303:
      case 307:
        if ( response.headers.location.includes("404")) {
          reject(new Error('Server responded with status code ' + response.statusCode + " to a 404 page\n" + headers));
        } else {
          resolve(response.headers.location);
        }
        break;
      default:
        reject(new Error('Server responded with status code ' + response.statusCode + "\n" + headers));
      }
    })
    .on('error', function(err) {
      reject("Server doesn't report any changes for " + apkURL);
      cb(err);
    });
  });// Promise
}

function isNewGNBAvailable(url, oldStatsFile) {
  var http_or_https = http;
  if (/^https:\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/.test(url)) {
      http_or_https = https;
  }
  var myURL = new URL(url);
  var options = {method: 'HEAD', host: myURL.host, port: myURL.port, path: myURL.pathname};
  return new Promise( function(resolve, reject) {
    var req = http_or_https.request(options, function(res) {
      var serverSize = res.headers["content-length"];
      var serverDateStr = res.headers["last-modified"];
      var isNewFileBySize = false;
      var isNewFileByDate = false;
      var oldStats = loadJSON(oldStatsFile);
      if ( !oldStats ) {
        SendIt("No existing stats for GNB updates, assuming first run")
        isNewFileBySize = false;
        isNewFileByDate = false;
        oldStats.size = serverSize;
        oldStats.datestr = serverDateStr;
        storeJSON(oldStats, config.GNBStats)
      } else {
        isNewFileBySize = serverSize != oldStats.size;
        isNewFileByDate = serverDateStr != oldStats.datestr;
      }
      if ( isNewFileByDate || isNewFileBySize ) {
        oldStats.size = serverSize;
        oldStats.datestr = serverDateStr;
        storeJSON(oldStats, config.GNBStats)
        resolve(oldStats);
      } else {
        reject("Server doesn't report any changes for " + url);
      }
    }); // http.request
    req.end();
  });// Promise
}

function isNewAPKAvailable(url, oldStats) { 
  var http_or_https = http;
  if (/^https:\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/.test(url)) {
      http_or_https = https;
  }
  var myURL = new URL(url);
  var options = {method: 'HEAD', host: myURL.host, port: myURL.port, path: myURL.pathname};
  return new Promise( function(resolve, reject) {
    var req = http_or_https.request(options, function(res) {
      var serverSize = res.headers["content-length"];
      var serverDateStr = res.headers["last-modified"];
      var isNewFileBySize = serverSize != oldStats.size;
      var isNewFileByDate = serverDateStr != oldStats.datestr;
      if ( isNewFileByDate || isNewFileBySize ) {
        oldStats.size = serverSize;
        oldStats.datestr = serverDateStr;
        storeJSON(oldStats, config.apkStatsFile)
        resolve(oldStats);
      } else {
        reject("Server doesn't report any changes for " + url);
      }
    }); // http.request
    req.end();
  });// Promise
}

function saveFilefromURL(url, path, cb) {
    var http_or_https = http;
    if (/^https:\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/.test(url)) {
        http_or_https = https;
    }
    http_or_https.get(url, function(response) {
        var headers = JSON.stringify(response.headers);
        switch(response.statusCode) {
            case 200:
                var file = fs.createWriteStream(path);
                response.on('data', function(chunk){
                    file.write(chunk);
                    process.stdout.write("Downloaded " + file.bytesWritten + " bytes so far\r");
                }).on('end', function(){
                    file.end();
                    cb(null);
                });
                break;
            case 301:
            case 302:
            case 303:
            case 307:
                saveFilefromURL(response.headers.location, path, cb);
                break;
            default:
                cb(new Error('Server responded with status code ' + response.statusCode + "\n" + headers));
        }
    })
    .on('error', function(err) {
        cb(err);
    });
}

function getSHA256FileHash(filename) {
    if ( fileExists(filename)) {
      const sha256 = crypto.createHash('sha256');
      sha256.update(fs.readFileSync(filename));   
      return sha256.digest('hex');
    } else {
      return 0;
    }
}

function getSHA256Hash(data) {
  const sha256 = crypto.createHash('sha256');
  sha256.update(data);   
  return sha256.digest('hex');
}

function JSONsyntaxHighlightHTML(json) {
  var html = `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
    <title>Isn't it pretty</title>
    <style>
        body { padding-top:5px; }
        pre {outline: 1px solid #ccc; padding: 5px; margin: 5px; }
        .string { color: green; }
        .number { color: darkorange; }
        .boolean { color: blue; }
        .null { color: magenta; }
        .key { color: red; }
    </style>
</head>
<body>
<pre>
{JSONHERE}
</pre>
</body>
</html>
  `
  if (typeof json != 'string') {
       json = JSON.stringify(json, undefined, 2);
  }
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  json = json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
      var cls = 'number';
      if (/^"/.test(match)) {
          if (/:$/.test(match)) {
              cls = 'key';
          } else {
              cls = 'string';
          }
      } else if (/true|false/.test(match)) {
          cls = 'boolean';
      } else if (/null/.test(match)) {
          cls = 'null';
      }
      return '<span class="' + cls + '">' + match + '</span>';
  });
  return html.replace("{JSONHERE}", json);
}

function makeConfigFile(configPath = configFile) {

  var userDir = os.homedir().replace(/\\/g, '/');
  var config = defaultConfig;

  // If we have an existing config, lay it over top the template one

  if (fileExists(configPath)) {
  var tconfig = loadJSON(configPath);
      for (let [key, value] of Object.entries(config)) {
        // console.log(key + ":" + value);
        if (typeof(tconfig[key]) != 'undefined') {
            config[key] = tconfig[key];
            // console.log("Updated template with existing " + key + ":" + config[key]);
        } else {
          // convert old values
          switch (key) {
            case 'GNBotLogMask' :
              config[key] = tconfig.LSSLog;
              break;
            case 'GNBotLogMain' :
              config[key] = tconfig.LSSLogMain;
              break; 
            case 'GNBotThreads' :
              config[key] = tconfig.LSSThreads;
              break; 
            case 'GNBotSettings' :
              config[key] = tconfig.LSSSettings;
              break;
            case 'GNBotProfile' :
              config[key] = tconfig.LSSProfile;
              break; 
            case 'GNBotDir' :
              config[key] = tconfig.LauncherDir;
              break;
            case 'gametime' :
              // the correct one
              if ( tconfig.gametime == "Australia/Sydney" ) {
                config[key] = "Atlantic/South_Georgia";
              }
              break;

            case 'processWatchTimer' :
              if ( tconfig.processWatchTimer > 20000 ) {  // now using seconds. Nobody should be checking every 20,000 seconds.
                config[key] = tconfig.processWatchTimer / 1000;
              }
              break;
            default:
              // insert the new ones
              console.log("No existing config found for " + key + ":" + config[key] + " Added. Please verify.");
          }
        }
      }
  }
  
  tconfig = JSON.stringify(config).replace(new RegExp('{USERDIR}', "g"), userDir);
  config = JSON.parse(tconfig);
  tconfig = JSON.stringify(config).replace(new RegExp('{GNBotDir}', "g"), config.GNBotDir);
  config = JSON.parse(tconfig);

  console.log(util.inspect(config, true, 4, true));

  console.log("Configuration file updated. Please check paths and values.");
  storeJSON(config, configPath);
 
}
