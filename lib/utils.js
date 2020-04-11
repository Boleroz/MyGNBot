/* Exports */
module.exports = {
    sendToOne: function(localClients, users, data, user, type) {
        for(var client in localClients) {
            if(localClients[client].un == user) {
                if(type == 'message') {
                    localClients[client].con.write(JSON.stringify(data));
                }

                if(type == 'role') {
                    localClients[client].role = data.role;
                    users[localClients[client].id].role = data.role;
                }
            }
        }
    },

    sendToAll: function(localClients, data) {
        for(var client in localClients) {
            if(localClients[client].role > 1 && (data.info === 'connection' || data.info === 'disconnection')) {
                data.user.ip = module.exports.getUserByID(localClients, data.user.id).ip;
            } else if(data.user) {
                delete data.user.ip;
            }

            localClients[client].con.write(JSON.stringify(data));
        }
    },

    sendBack: function(localClients, data, user) {
        localClients[user.con.id].con.write(JSON.stringify(data));
    },

    checkUser: function(localClients, user) {
        for(var client in localClients) {
            if(localClients[client].un === user) {
                return true;
            }
        }
        return false;
    },

    getUserByName: function(localClients, name) {
        for(client in localClients) {
            if(localClients[client].un === name) {
                return localClients[client];
            }
        }
    },

    getUserByID: function(localClients, id) {
        for(client in localClients) {
            if(localClients[client].id === id) {
                return localClients[client];
            }
        }
    },

    normalizePort: function(val) {
        var port = parseInt(val, 10);

        if(isNaN(port)) {
            return val;
        }

        if(port >= 0) {
            return port;
        }

        return false;
    }
}