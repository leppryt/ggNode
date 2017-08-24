var net = require("net");
var server = net.createServer();
var clients = {};
var msgQueue = {};
var ms = 1000;

var broadcast = function(data) {
	var keys = Object.keys(clients);
	var len = keys.length;
	for(var i = 0; i < len; i++){
		var s = clients[keys[i]].socket;
		if (s)
			s.write(data+"+");
	}
}

var broadcastRoom = function(obj){
	if(!msgQueue[obj.room]) {
		msgQueue[obj.room] = [];
	}
	msgQueue[obj.room].push({
		sndr: obj.sndr,
		name: obj.name,
		rcvr: obj.rcvr,
		ev: obj.ev,
		msg: obj.msg,
		ctr: 0
	});
	console.log(msgQueue);
}

var processQueue = function(){
	var keys = Object.keys(msgQueue);
	var len = keys.length;
	for(var i = 0; i < len; i++){
		var q = msgQueue[keys[i]][0];
		if(!q) continue; //nothing on queue.. na na na nothin' on queue babe
		q.ctr++;
		var senderId = q.sndr.trim();
		if(q.rcvr){
			var c = clients[q.rcvr.trim()];
			console.log("rcvr name: "+q.name+"\nctr: "+q.ctr);
			var msg = q.msg ? q.msg.trim() : "";
			if(c && c.socket){
				if(keys[i] == c.room)
					c.socket.write(q.ev+"|"+senderId+"|"+q.name+"|"+keys[i]+"|"+msg+"+");
				else
					delete msgQueue[keys[i]]; //lepp bantayan, i may do i--
			} else{
				console.log("did not write");
			}
		} else console.log("no rcvr on queue: "+ q.ctr);
		if (q.ctr > (1000/ms)*120) { //after 120 sec
			var c = clients[senderId];//return to sender
			if(c && c.socket){
				if(c.room && c.room == keys[i]){
					c.socket.write("awol|No feedback from user."+"+");
					c.room="";
				}
				broadcast("push|"+senderId);
			}
			delete msgQueue[keys[i]];
		}
	}
}

var reconClient = function(socket, id){
	socket.id = id;
	var client = clients[id.trim()];
	if(client)
			client.socket = socket;		
	else
		console.log("not found on clients list");
	return client;
}

server.on("connection", function (socket) {
    var remoteAddress = socket.remoteAddress + ":" + socket.remotePort;
    socket.on("data", function (d) {
        console.log("Data: %s", d);
		var data = d.toString().split("|");
		if (!data[1]) return;
		var sid = data[1].trim();
		switch(data[0]){
			case "login"://id, username
				socket.id = sid;
				clients[sid] = {
					"id": sid,
					"username": data[2].trim(),
					"room": "",
					"remove": false,
					"socket": socket
				};
				broadcast("logSuccess|"+ sid+ "|"+ data[2]);
				break;
			case "chat"://id, msg
				var client = reconClient(socket, sid);
				if (!client) return;
				broadcast("chat|"+client.id+"|"+client.username+"|"+data[2]);
				client.room = "";
				break;
			case "move"://id, msg
				var client = reconClient(socket, sid);
				if (!client) return;
				var sendInfo = {
					"ev": data[0],
					"sndr": sid,
					"room": client.room,
					"rcvr": client.rcvr,
					"name": client.username, //sndr name
					"msg": data[2]
				};
				broadcastRoom(sendInfo);
				break;
			case "pm"://id, msg
				var client = reconClient(socket, sid);
				if (!client) return;
				var sendInfo = {
					"ev": data[0],
					"sndr": sid,
					"room": client.room,
					"rcvr": client.rcvr,
					"name": client.username, //sndr name
					"msg": data[2]
				};
				broadcastRoom(sendInfo);
				break;
			case "arrBoard"://id, msg
				var client = reconClient(socket, sid);
				if (!client) return;
				var sendInfo = {
					"ev": data[0],
					"sndr": sid,
					"room": client.room,
					"rcvr": client.rcvr,
					"name": client.username, //sndr name
					"msg": data[2]
				};
				broadcastRoom(sendInfo);
				break;
			case "challenge"://id, room, myuserid:recvr
				var client = reconClient(socket, sid);
				if (!client) return;
				broadcast("pull|"+sid);
				var rcvr = clients[data[3].trim()];
				if (rcvr){//make sure user is still available
					client.room = data[2];
					rcvr.room = data[2];
					var sendInfo = {
						"ev": data[0],
						"sndr": sid,
						"room": data[2],
						"rcvr": data[3],
						"name": client.username, //sndr name
						"msg": ""
					};
					broadcastRoom(sendInfo);
				} else{
					socket.write("awol|User not available."+"+");
				}
				break;
			case "accept"://id, rcvr
				var client = reconClient(socket, sid);
				if (!client) return;
				broadcast("pull|"+sid);
				var rcvr = clients[data[2].trim()];
				if (rcvr){
					var sendInfo = {
						"ev": data[0],
						"sndr": sid,
						"room": client.room,
						"rcvr": data[2],
						"name": client.username, //sndr name
						"msg": ""
					};
					client.rcvr = data[2];
					rcvr.rcvr = sid;
					broadcastRoom(sendInfo);
				} else
					socket.write("awol|User not available."+"+");
				break;
			case "decline"://id, rcvr
				var client = reconClient(socket, sid);
				if (!client) return;
				broadcast("push|"+sid);
				var rcvr = clients[data[2].trim()];
				if (rcvr){
					var sendInfo = {
						"ev": data[0],
						"sndr": sid,
						"room": client.room,
						"rcvr": data[2],
						"name": client.username, //sndr name
						"msg": ""
					};
					broadcastRoom(sendInfo);
					client.room = ""; //lepp bantayan
				}
				break;
			case "timeout":
				var client = reconClient(socket, sid);
				if (!client) return;
				broadcastRoom("timeout|"+client.username,client.room,sid);
				break;
			case "quit": //id
				var client = reconClient(socket, sid);
				if (!client) return;
				broadcast("push|"+sid);
				var sendInfo = {
					"ev": data[0],
					"sndr": sid,
					"room": client.room,
					"rcvr": client.rcvr,
					"name": client.username, //sndr name
					"msg": ""
				};
				client.room = ""; //client.room deleted;
				broadcastRoom(sendInfo);
				break;
			case "push": //back in to available
				var client = reconClient(socket, sid);
				if (!client) return;
				broadcast("push|"+sid);
				break;
			case "exitApp":
				var client = reconClient(socket, sid);
				if (!client) return;
				client.remove = true;
				break;
			case "conf": //id, orig event // only for confirming msg is rcvd, not for actual response/event				
				var client = reconClient(socket, sid);
				if (!client) return;
				console.log("client.room: " + client.room);
				console.log(msgQueue[client.room]);
				if (msgQueue[client.room]&&msgQueue[client.room].length > 0)
					msgQueue[client.room].splice(0,1);
				switch (data[2].trim()){
					case "challenge":
						broadcast("pull|"+sid);
						break;
					case "quit":
						client.room = "";
						broadcast("push|"+sid);
						break;
					case "decline":
						client.room = "";
						broadcast("push|"+sid);
						break;
					case "move"://special case
						var sendInfo = {
							"ev": "timer",
							"sndr": sid,
							"room": client.room,
							"rcvr": client.rcvr,
							"name": "", //sndr name
							"msg": data[3]
						};
						broadcastRoom(sendInfo);
						break;
				}
				break;
			case "cancel"://id, room, myuserid:recvr
				//challenger cancelled request
				var client = reconClient(socket, sid);
				broadcast("push|"+sid);
				if (!client) return;
				if(client.room){
					delete msgQueue[client.room];
					client.room="";
				}
				var rcvr = clients[data[3].trim()];
				if(rcvr && rcvr.socket){
					broadcast("push|"+data[3].trim());
					rcvr.room="";
					rcvr.socket.write("cancel|"+data[3].trim()+"+");
				}
				break;
			case "end":
				var client = reconClient(socket, sid);
				if (!client) return;
				broadcast("push|"+sid);
				if(client.room){
					if (msgQueue[client.room])
						delete msgQueue[client.room];
					client.room="";
				}
				break;
			case "ping":
				reconClient(socket, sid);
				break;
			default:
				console.log("No recognizable code");
				break;
		}
    });

    socket.once("close", function () {//get "event interrupted"
		if (!socket.id) return;
		var sid = socket.id.trim();
		broadcast("pull|"+sid);
        console.log("Connection from %s closed", sid);
		var client = clients[sid];
		if (!client) return;
		if(!client.remove) {
			console.log(client.username + ' disconnected, will recon.');			
			delete clients[sid].socket;		
		} else {
			console.log("user goodbye", client.username);
			if (client.room) {
				var sendInfo = {
					"ev": "quit",
					"sndr": sid,
					"room": client.room,
					"rcvr": client.rcvr,
					"name": client.username, //sndr name
					"msg": ""
				};
				broadcastRoom(sendInfo);//no need to delete room because goodbye
			}
			broadcast("left|"+client.id+"|"+client.username)
			delete clients[sid];
		}
    });

    socket.on("error", function (err) {
		var sid = socket.id;
		if(!sid) return;
		sid = sid.trim();
        console.log("Connection %s error: %s", sid, err.message);
		if(sid)
			if(clients[sid]) {
				var client = clients[sid];
				if (client.room && client.remove) {
					var sendInfo = {
						"ev": "quit",
						"sndr": sid,
						"room": client.room,
						"rcvr": client.rcvr,
						"name": client.username, //sndr name
						"msg": ""
					};
					broadcastRoom(sendInfo);//no need to delete room because goodbye
				}
				delete clients[sid].socket;
				if(!clients[sid].socket)
					console.log("deleted");
			}
    });

});

server.listen(3000, function () {
    console.log("server listening to %j", server.address());
	
});

setInterval(processQueue, ms); 