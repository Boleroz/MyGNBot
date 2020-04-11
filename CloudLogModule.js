// CloudLogModule.js

module.exports = {
   hello: function() {
      return "Hello";
   },
   cloudLogInit,
   cloudLogSubmit
}

var https;

function cloudLogInit(httpHandle = {}) {
    console.log("Cloud log module initialized!");
    https = httpHandle;
}

function cloudLogSubmit(cloudConfig = {}, uuid = "", base = {}, pattern_key = "", raw_log = "", formatted_log = "") {
    if ( cloudConfig.enabled > 5 ) {
      console.log(cloudConfig);
      console.log("uuid: " + uuid);
      console.log("str: " + raw_log);
      console.log("message: " + formatted_log);
    }

    var postData = JSON.stringify({
        "uuid": uuid,
		"base": base,
		"event": pattern_key,
        "friendly": formatted_log,
        "msg": raw_log
    });

    const options = {
        hostname: cloudConfig.host,
        port: cloudConfig.port,
        path: cloudConfig.endpoint,
		timeout: 3000,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': postData.length,
			'token': cloudConfig.token
        }
    }

    const req = https.request(options, (res) => {
        if ( cloudConfig.enabled > 1 ) {
            console.log(`statusCode: ${res.statusCode}`)
        }      
        res.on('data', (d) => {
          if ( cloudConfig.enabled > 2 ) {
              console.log(d.toString());
          }
        });
      
        req.on('error', (error) => {
            if (err.code === "ECONNRESET") {
                console.log("Timeout occurs");
                return;
            } else {
                console.error(error)
            }
        });
    })  
    req.write(postData);
    req.end();
    
}
