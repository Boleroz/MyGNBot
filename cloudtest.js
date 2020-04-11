const args = process.argv.slice(2)
const util = require('util');
const fs = require('fs');
const https = require('https');

console.log(util.inspect(args));

var logSample = args[0];

if ( !fs.existsSync(logSample) ) {
    console.log("Cannot locate sample log file " + logSample);
    console.log("Please pass the filename as a parameter. EXITING!");
    process.exit(1);
}

var configFile = "./mybotcloud.json";

if ( !fs.existsSync(configFile) ) {
    console.log("Cannot locate my config file " + configFile);
    console.log("Please pass 'config' parameter on commandline to create one.\nEXITING!");
    process.exit(1);
}

var config = require(configFile);
var cloudLogs = {};

// XXX Experimental
if ( typeof(config.cloudLogs) != 'undefined' ) {
    console.log(util.inspect(config.cloudLogs));
    cloudLogs = require(config.cloudLogs.source);
    cloudLogs[config.cloudLogs.init](https);
}

function parse_logs() {
    var logs = fs.readFileSync(logSample).toString().split("\n");
    var base = {
        "name": "test",
        "id": 1,
        "last_time": "Yesterday",
        "uuid": "20202211-bbbb-cccc-dddd-000000000001", 
        "active": true
        };
    logs.forEach( log => {
        if ( typeof(config.cloudLogs) != 'undefined' && !log.match(new RegExp('/*Images.FindInArea*/'))) {
            cloudLogs[config.cloudLogs.submit](config.cloudLogs, uuid = "20202211-bbbb-cccc-dddd-000000000001", base, "test:test", log, "formatted log");
        } else {
            console.log("Skipped " + log);
        }
    });
}

parse_logs();
