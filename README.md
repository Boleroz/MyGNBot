# MyGNBot

EVERYTHING HERE IS A WORK IN PROGRESS - This needs updating

## About

MyGNBot was born out of the need to be able to manage the GNBot while traveling. I decided I would take it on as my little tech project to familiarize myself with node.js

The desire grew into needing to have the capability to keep the bot running when it would crash and has grown from there to serve my and several others needs. Sharing with others necessitated the need to make it easier to configure. This need created another opportuntiy - to familiarize myself with .NET. A configuration IU can now manage the config, download needed files, start and stop the Discord bot which in turn managed the GNBot status. The GUI can manage the configuration for you or if you are command line inclined you can manage the configuration and run without a GUI at all. 

## Quickstart

- Make a folder on your Desktop named MyDiscordBot
- Make several folders in MyDiscordBot
  - Logs
  - Config
  - Screenshots
  - Backup
- Download the [GUI application](https://github.com/Boleroz/MyDiscBot/raw/master/MyDiscBotConfig/MyDiscBotConfig.exe) to the MyDiscordBot folder and run it
- Navigate to the Download tab
  - Download the manifest
  - Download all
- Navigate to the Basic Config tab and configure it
- Check out the other tabs, explore things, make changes if needed
- Save your config and close the GUI
- Right click on the GUI and select run as administrator
- Go to the Run tab
- Click start

If everything went well you will see output and in about 30 seconds GNBot will start

## Making it automatic
The GUI supports a command line parameter of "-start" which will start the GUI and begin running the bot. To use this effectively you need to create a shortcut on the desktop and add "-start" to the end of the program line. Now click the advanced tab and check the run as administrator checkbox. Double click the shortcut and things will start running on their own.

This tool includes the ability to reboot the computer when things go wrong. It happens too often unfortunately. The best way to make things even more automatic is to configure your computer to automatically reboot once a day ([using task scheduler](https://www.windowscentral.com/how-create-automated-task-using-task-scheduler-windows-10)), [log in automatically](https://www.cnet.com/how-to/automatically-log-in-to-your-windows-10-pc/), and start the GUI ([using task scheduler](https://www.windowscentral.com/how-create-automated-task-using-task-scheduler-windows-10)) on login. Doing this will mean you can enable reboot and your bot will always be running. I'll add more detailed instructions for that later but google is your friend here. 

A separate [Git for the GUI](https://github.com/Boleroz/MyDiscBotConfig) has been published. 

## Screenshots

Basic configuration
![Basic Configuration Screen](https://raw.githubusercontent.com/Boleroz/MyDiscBot/master/MyDiscBotConfig/Screencaptures/Basic%20Configuration.jpeg)

Advanced configuration
![Advanced Configuration Screen](https://raw.githubusercontent.com/Boleroz/MyDiscBot/master/MyDiscBotConfig/Screencaptures/Advanced%20Configuration.jpeg)

Running the Discord bot
![Discord bot screen](https://raw.githubusercontent.com/Boleroz/MyDiscBot/master/MyDiscBotConfig/Screencaptures/Running.jpeg)

Download manager
![Download screen](https://raw.githubusercontent.com/Boleroz/MyDiscBot/master/MyDiscBotConfig/Screencaptures/DownloadManager.jpeg)

## Managing gather at location with a spreadsheet!

Have you ever wished you didn't have to make so man bookmarks or have to edit so many locations to move gathers around? Now you can manage you gathers with a CSV file or a google spreadsheet. 

CSV Configuration
![CSV Configuration Screen](https://raw.githubusercontent.com/Boleroz/MyDiscBot/master/MyDiscBotConfig/Screencaptures/Google%20Sheets.jpeg)

## Managing GNBot without logging into windows

You can set up your own discord channel for your accounts that will allow you to get status updates, manage the bot, and do other administrative tasks with ! commands. For example. If you want to stop GNBot but can't get home for a while you can issue !stop. 

### Here are some examples of what is possible. 

#### Manage the state of GNBot
!start Start a paused GNBot
!stop Stop a running GNBot - Forced upgrades anyone? stop things before they need to be reset. 
!pause <minutes> will stop a running GNBot (pause it) for <minutes> time
!restart Stop tehn start GNBot
!resume Cancel a pause and start now
!disable Disable the automatic starting of GNBot when DiscBot starts (not tested)
!enable Enable the automatic starting of GNBot

#### ever wish things would speed up or slow down once in a while? (KE Anyone) 
!threads (or !sessions) <number> This changes the configured number of sessions for the GNBot so it can go faster or slower as desired

#### ever have a server maintenance cause your timers to be all wrong? Want to pause things during maintenance? 
!maintenance (or !maint) <startminutes> <forhowlong> This schedules maintenance in <start minutes> for <how long minutes>
!maintenance:cancel (or !maint:cancel) <- cancels maintenance

#### ever have a hung memu messing things up? 
!close <basename> This does a task kill on the window (menu instance) with that name

#### ever have a system just go sideways and need a reboot?
!reboot <minutes> <- schedules a reboot in minutes time
!abort <- aborts a pending reboot

#### ever have GNBot get stuck? 
!killbot Performs a taskkill of GNBot. For those times GNBot refuses to close and is crashed.

Discord Configuration
![Discord Configuration Screen](https://raw.githubusercontent.com/Boleroz/MyDiscBot/master/MyDiscBotConfig/Screencaptures/DiscordConfiguration.jpg)

#### Ever wish you could have a different GNBot configurations by day
Now, you can make a configuration for each day and DiscBot will make it active near reset every day. Each config file should be created in GNBot by configuring and then saving the config file to the Configs directory with a unique name. If a specified file is not found, the default (default.json) will be used. You will have to save ALL changes made here or they will be overwritten with the last saved config.

#### The format of the CSV or Google sheet should be
    name,gatherNum,cfg.x,cfg.y,cfg.farm,cfg.fuel,cfg.lumber,cfg.iron,cfg.monday,cfg.tuesday,cfg.wednesday,cfg.thursday,cfg.friday,cfg.saturday,cfg.sunday,cfg.equalize,cfg.ignoreOthers,cfg.skipAfterMarchFail
    Base1,1,800,469,false,false,false,true,true,true,true,true,true,true,true,true,false,5
    Base1,2,800,468,false,true,false,false,true,true,true,true,true,true,true,true,false,5
    Base1,3,800,467,false,false,false,true,true,true,true,true,true,true,true,true,false,5
    Base1,4,800,466,false,true,false,false,true,true,true,true,true,true,true,true,false,5
    Base2,1,800,465,false,false,false,true,true,true,true,true,true,true,true,true,false,5
    Base2,2,800,464,false,true,false,false,true,true,true,true,true,true,true,true,false,5
    Base2,3,800,463,false,false,false,true,true,true,true,true,true,true,true,true,false,5
    Base2,4,800,462,false,true,false,false,true,true,true,true,true,true,true,true,false,5
    Base3,1,941,490,false,false,false,true,true,true,true,true,true,true,true,true,false,5
    Base3,2,942,490,false,true,false,false,true,true,true,true,true,true,true,true,false,5
    Base3,3,944,490,false,false,false,true,true,true,true,true,true,true,true,true,false,5
    Base3,4,946,490,false,true,false,false,true,true,true,true,true,true,true,true,false,5

#### Take screenshot or video on demand through discord
Ever wonder if things are still working?
!screenshot Will take a screenshot of the desktop(s). (must be enabled and configured)
!video Will take a 30 second video of the desktop(s).

#### creates a unified archive of GNBot logs so you can actually see what happened in the past
Ever wish you could go back in time and figure out what happened? DoscBot makes a unified log file and compresses them so that you can go see what happened. 
