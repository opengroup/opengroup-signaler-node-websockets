var server = require('http').createServer()
    , url = require('url')
    , WebSocketServer = require('ws').Server
    , wss = new WebSocketServer({ server: server })
    , express = require('express')
    , app = express()
    , port = 4080;

app.use(function (req, res) {
    res.send({ msg: "hello" });
});

var rooms = {};
var connectionsStrings = {};

wss.on('connection', function connection(ws) {
    var location = url.parse(ws.upgradeReq.url, true);
    var roomName = location.path;
    if (!rooms[roomName]) { rooms[roomName] = []; }

    ws.on('message', function incoming(message) {
        var data = JSON.parse(message);

        if (data.command == 'identify') {
            ws.uuid = data.uuid;
            rooms[roomName].push(ws);
            connectEveryone(roomName);
        }

        if (data.command == 'pass-offer') {
            var targetWs = rooms[roomName].find(ws => ws.uuid === data.toUuid)

            if (targetWs) {
                targetWs.send(JSON.stringify({
                    command: 'create-answer',
                    uuid: data.uuid,
                    offer: data.offer
                }));
            }
        }

        if (data.command == 'pass-answer') {
            var targetWs = rooms[roomName].find(ws => ws.uuid === data.toUuid)

            if (targetWs) {
                targetWs.send(JSON.stringify({
                    command: 'accept-answer',
                    uuid: data.uuid,
                    answer: data.answer
                }));
            }
        }
    });

    ws.on('close', function () {
        var index = rooms[roomName].indexOf(ws);
        if (index > -1) {
            rooms[roomName].splice(index, 1);
            removeConnectionStringsForUuid(roomName, ws.uuid);
        }
    })
});

function removeConnectionStringsForUuid (roomName, uuid) {
    connectionsStrings[roomName].forEach((connectionsString, delta) => {
        var participants = connectionsString.split('_');

        if (participants[0] == uuid || participants[1] == uuid) {
            connectionsStrings[roomName].splice(delta, 1);
        }
    });
}

function connectEveryone (roomName) {
    if (!connectionsStrings[roomName]) { connectionsStrings[roomName] = []; }

    rooms[roomName].forEach(function (outerWs) {
        rooms[roomName].forEach(function (innerWs) {
            if (outerWs.uuid != innerWs.uuid &&
                connectionsStrings[roomName].indexOf(outerWs.uuid + '_' + innerWs.uuid) == -1 &&
                connectionsStrings[roomName].indexOf(innerWs.uuid + '_' + outerWs.uuid) == -1) {

                connectionsStrings[roomName].push(outerWs.uuid + '_' + innerWs.uuid);

                innerWs.send(JSON.stringify({
                    command: 'create-offer',
                    uuid: outerWs.uuid
                }))
            }
        });
    });
}

server.on('request', app);
server.listen(port, function () { console.log('Listening on ' + server.address().port) });