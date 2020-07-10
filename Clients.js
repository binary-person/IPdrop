const generate_name = require('adjective-adjective-animal');

/**
 * "clients" format as follows:
 * {
 *     "1.1.1.1": {
 *         "Silly Blue Goose": websocket_object
 *     },
 *     "a.lot.more.ips": {...}
 * }
 */

class Clients{
    constructor() {
        this.clients = {}; // can't use static variables for some reason
    }
    async addClient(ip, client_ws) {
        var name = await generate_name('title');
        var count = 0;
        while(!this.getClient(ip, name, true).fake) { // eliminate the slightest possibility of name clashing
            name = await generate_name('title');
            if(count++ >= 10){ // account for the possibility that generate_name reached its limit
                var name_count = 1;
                var name_prefix = name+' ';
                do { // this step is super duper extremely unlikely to happen
                    name = name_prefix + name_count++;
                }while(!this.getClient(ip, name).fake);
            }
        }

        if(!this.clients[ip]) this.clients[ip] = {};
        this.clients[ip][name] = client_ws;
        return name;
    }
    removeClient(ip, name) {
        if(this.clients[ip] && this.clients[ip][name]){
            delete this.clients[ip][name];
            if(!Object.keys(this.clients[ip]).length){
                delete this.clients[ip];
            }
        }
    }
    getClient(ip, name, test) {
        if(this.clients[ip] && this.clients[ip][name]) return this.clients[ip][name];
        if(!test) console.error('error occurred. IP: '+ip+' name: '+name+' resulted in inability to find ws_obj');
        return { send: function(){}, fake: true }; // fake it for error surpressing purposes
    }
    getClientsByIP(ip, name) {
        if(!this.clients[ip]) return []; // theoretically shouldn't happen
        let client_names = Object.keys(this.clients[ip]);
        if(!name) return client_names;

        var index = client_names.indexOf(name);
        if(index !== -1){
            client_names.splice(index, 1);
        }
        return client_names;
    }
}

module.exports = Clients;