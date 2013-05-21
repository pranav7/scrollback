var irc = require("./irc.js"),
	express = require("express"),
	app = express(),
	server = require("http").createServer(app),
	io = require("socket.io").listen(server),
	archive = require("./archive.js"),
	cookie = require("cookie"),
	user = require("./user.js");

app.use(express.logger());
app.use(express.static(__dirname + '/client'));
app.use(express.cookieParser());
app.use(express.session({secret: "syugeheijak"}));
app.use(express.bodyParser());
app.get('/:stream', function(req, res) {
	res.writeHead(302, {Location: "/index.html?stream=" + req.params.stream});
	res.end();
});
app.post('/:login', function(req, res) {
	user.get(req.body, function(user) {
		req.session.user = user;
	});
});

server.listen(7777);

//---------------------------------------------------------------

io.set('log level', 1);
io.sockets.on('connection', function(socket) {
	var clients = {},
		nick = 'guest' + Math.floor(Math.random() * 1000),
		sid = cookie.parse(socket.handshake.headers.cookie)['connect.sid'];
		
		console.log("Connection from SID", sid);
	
	socket.on('message', function(message) {
		if(!(client = clients[irc.getServer(message.to)])) {
			socket.emit('error', message.to + ' is not connected.');
			return;
		}
		client.say('#' + message.to, message.text);
	});
	
	socket.on('join', function(id) {
		if(!id) return;
		var server = irc.getServer(id), client = clients[server];
		if(!client) {
			clients[server] = client = irc.connect(server, nick, function(message) {
				socket.emit('message', message);
			});
			client.addListener('registered', function() {
				client.join('#'+id);
			});
		} else {
			client.join('#'+id);
		}
	});
	
	socket.on('get', function(qo) {
		archive.get(qo, function(err, data) {
			var i, l;
			if(err) {
				console.log(err); return;
			}
			console.log("Got " + data.length + " messages from archive.");
			for(i=0, l = data.length; i<l; i++) {
				socket.emit('message', data[i]);
			}
		});
	});
	
	socket.emit('nick', nick);
	socket.on('nick', function(n) {
		var i;
		nick = n;
		for(i in clients) {
			console.log("Sending NICK message", nick);
			clients[i].send('NICK', nick);
		}
	});
	
	socket.on('login', function() {
		
	});
	
	socket.on('disconnect', function() {
		var i;
		for(i in clients) {
			clients[i].disconnect();
			delete clients[i]; // Speed up GC?
		}
	});
});

